package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"imagen/backend/internal/domain"
)

const (
	adminSessionCookie    = "imagegen_admin_session"
	customerSessionCookie = "imagegen_customer_session"
	oauthStateCookie      = "imagegen_oauth_state"
	oauthReturnCookie     = "imagegen_oauth_return_to"
	oauthAudienceCookie   = "imagegen_oauth_audience"

	oauthAudienceAdmin  = "admin"
	oauthAudienceClient = "client"
)

type adminSession struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	Exp     int64  `json:"exp"`
}

type googleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (a *API) adminLoginPage(c *gin.Context) {
	if session, ok := a.readAdminSession(c); ok {
		c.Redirect(http.StatusFound, "/admin?email="+session.Email)
		return
	}
	renderAdminLogin(c, a.googleConfigured(), c.Query("error"))
}

func (a *API) googleStart(c *gin.Context) {
	a.startGoogleOAuth(c, oauthAudienceAdmin, "/admin")
}

func (a *API) clientGoogleStart(c *gin.Context) {
	a.startGoogleOAuth(c, oauthAudienceClient, "/client")
}

func (a *API) startGoogleOAuth(c *gin.Context, audience, defaultPath string) {
	if !a.googleConfigured() {
		if audience == oauthAudienceClient {
			c.Redirect(http.StatusFound, a.frontendClientURL("google_oauth_not_configured"))
			return
		}
		c.Redirect(http.StatusFound, a.frontendLoginURL("google_oauth_not_configured"))
		return
	}
	state := randomToken(24)
	returnTo := a.safeFrontendReturnToDefault(c.Query("return_to"), defaultPath)
	a.setCookie(c, oauthStateCookie, state, 10*time.Minute)
	a.setCookie(c, oauthReturnCookie, returnTo, 10*time.Minute)
	a.setCookie(c, oauthAudienceCookie, audience, 10*time.Minute)
	c.Redirect(http.StatusFound, a.oauthConfig(c.Request.Context()).AuthCodeURL(state, oauth2.AccessTypeOnline))
}

func (a *API) googleCallback(c *gin.Context) {
	expected, err := c.Cookie(oauthStateCookie)
	if err != nil || expected == "" || !hmac.Equal([]byte(expected), []byte(c.Query("state"))) {
		c.Redirect(http.StatusFound, a.frontendLoginURL("invalid_oauth_state"))
		return
	}
	returnTo, _ := c.Cookie(oauthReturnCookie)
	audience, _ := c.Cookie(oauthAudienceCookie)
	if audience == "" {
		audience = oauthAudienceAdmin
	}
	defaultPath := "/admin"
	if audience == oauthAudienceClient {
		defaultPath = "/client"
	}
	returnTo = a.safeFrontendReturnToDefault(returnTo, defaultPath)
	a.clearCookie(c, oauthStateCookie)
	a.clearCookie(c, oauthReturnCookie)
	a.clearCookie(c, oauthAudienceCookie)
	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		c.Redirect(http.StatusFound, a.frontendLoginURL("missing_oauth_code"))
		return
	}
	token, err := a.oauthConfig(c.Request.Context()).Exchange(c.Request.Context(), code)
	if err != nil {
		c.Redirect(http.StatusFound, a.frontendLoginURL("oauth_exchange_failed"))
		return
	}
	user, err := a.fetchGoogleUser(c.Request.Context(), token)
	if err != nil || user.Email == "" || !user.EmailVerified {
		c.Redirect(http.StatusFound, a.frontendLoginURL("google_email_not_verified"))
		return
	}
	session := adminSession{
		Email:   strings.ToLower(strings.TrimSpace(user.Email)),
		Name:    strings.TrimSpace(user.Name),
		Picture: strings.TrimSpace(user.Picture),
		Exp:     time.Now().UTC().Add(12 * time.Hour).Unix(),
	}
	if audience == oauthAudienceClient {
		if _, err := a.app.GetOrCreateCustomerForGoogle(c.Request.Context(), session.Email, session.Name); err != nil {
			c.Redirect(http.StatusFound, a.frontendClientURL("customer_session_failed"))
			return
		}
		value, err := a.signSession(session)
		if err != nil {
			c.Redirect(http.StatusFound, a.frontendClientURL("session_failed"))
			return
		}
		a.setCookie(c, customerSessionCookie, value, 12*time.Hour)
		c.Redirect(http.StatusFound, returnTo)
		return
	}
	if !a.adminEmailAllowed(user.Email) {
		c.Redirect(http.StatusFound, a.frontendLoginURL("admin_not_allowed"))
		return
	}
	value, err := a.signSession(session)
	if err != nil {
		c.Redirect(http.StatusFound, a.frontendLoginURL("session_failed"))
		return
	}
	a.setCookie(c, adminSessionCookie, value, 12*time.Hour)
	c.Redirect(http.StatusFound, returnTo)
}

func (a *API) adminLogout(c *gin.Context) {
	a.clearCookie(c, adminSessionCookie)
	c.Redirect(http.StatusFound, "/admin/login")
}

func (a *API) adminAPILogout(c *gin.Context) {
	a.clearCookie(c, adminSessionCookie)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *API) clientAPILogout(c *gin.Context) {
	a.clearCookie(c, customerSessionCookie)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *API) requireAdminSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, ok := a.readAdminSession(c)
		if !ok {
			c.Redirect(http.StatusFound, "/admin/login")
			c.Abort()
			return
		}
		c.Set("admin_session", session)
		c.Next()
	}
}

func currentAdminSession(c *gin.Context) adminSession {
	value, _ := c.Get("admin_session")
	session, _ := value.(adminSession)
	return session
}

func adminSessionDTO(session adminSession) gin.H {
	return gin.H{
		"email":   session.Email,
		"name":    session.Name,
		"picture": session.Picture,
		"exp":     session.Exp,
	}
}

func (a *API) googleConfigured() bool {
	return strings.TrimSpace(a.app.Config.GoogleClientID) != "" &&
		strings.TrimSpace(a.app.Config.GoogleClientSecret) != ""
}

func (a *API) oauthConfig(_ context.Context) *oauth2.Config {
	redirectURL := strings.TrimSpace(a.app.Config.GoogleRedirectURL)
	if redirectURL == "" {
		redirectURL = a.app.Config.PublicBaseURL + "/admin/auth/google/callback"
	}
	return &oauth2.Config{
		ClientID:     a.app.Config.GoogleClientID,
		ClientSecret: a.app.Config.GoogleClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

func (a *API) fetchGoogleUser(ctx context.Context, token *oauth2.Token) (googleUserInfo, error) {
	client := a.oauthConfig(ctx).Client(ctx, token)
	resp, err := client.Get("https://openidconnect.googleapis.com/v1/userinfo")
	if err != nil {
		return googleUserInfo{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return googleUserInfo{}, errors.New("google userinfo failed")
	}
	var user googleUserInfo
	return user, json.NewDecoder(resp.Body).Decode(&user)
}

func (a *API) adminEmailAllowed(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	for _, allowed := range a.app.Config.AdminAllowedEmails {
		if email == strings.ToLower(strings.TrimSpace(allowed)) {
			return true
		}
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false
	}
	domain := strings.ToLower(strings.TrimSpace(parts[1]))
	for _, allowed := range a.app.Config.AdminAllowedDomains {
		if domain == strings.ToLower(strings.TrimSpace(allowed)) {
			return true
		}
	}
	return false
}

func (a *API) readAdminSession(c *gin.Context) (adminSession, bool) {
	value, err := c.Cookie(adminSessionCookie)
	if err != nil || strings.TrimSpace(value) == "" {
		return adminSession{}, false
	}
	session, err := a.verifySession(value)
	if err != nil || session.Exp < time.Now().UTC().Unix() {
		return adminSession{}, false
	}
	if !a.adminEmailAllowed(session.Email) {
		return adminSession{}, false
	}
	return session, true
}

func (a *API) readCustomerSession(c *gin.Context) (adminSession, bool) {
	value, err := c.Cookie(customerSessionCookie)
	if err != nil || strings.TrimSpace(value) == "" {
		return adminSession{}, false
	}
	session, err := a.verifySession(value)
	if err != nil || session.Exp < time.Now().UTC().Unix() || strings.TrimSpace(session.Email) == "" {
		return adminSession{}, false
	}
	return session, true
}

func (a *API) currentCustomerSession(c *gin.Context) (domain.Customer, adminSession, bool) {
	if session, ok := a.readCustomerSession(c); ok {
		customer, err := a.app.GetOrCreateCustomerForGoogle(c.Request.Context(), session.Email, session.Name)
		if err == nil {
			return customer, session, true
		}
	}
	if session, ok := a.readAdminSession(c); ok {
		customer, err := a.app.GetOrCreateCustomerForGoogle(c.Request.Context(), session.Email, session.Name)
		if err == nil {
			if value, signErr := a.signSession(session); signErr == nil {
				a.setCookie(c, customerSessionCookie, value, time.Until(time.Unix(session.Exp, 0)))
			}
			return customer, session, true
		}
	}
	return domain.Customer{}, adminSession{}, false
}

func (a *API) signSession(session adminSession) (string, error) {
	raw, err := json.Marshal(session)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(raw)
	sig := hmacSHA256Hex([]byte(a.app.Config.SessionSecret), payload)
	return payload + "." + sig, nil
}

func (a *API) verifySession(value string) (adminSession, error) {
	parts := strings.SplitN(value, ".", 2)
	if len(parts) != 2 {
		return adminSession{}, errors.New("invalid session")
	}
	expected := hmacSHA256Hex([]byte(a.app.Config.SessionSecret), parts[0])
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return adminSession{}, errors.New("invalid session signature")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return adminSession{}, err
	}
	var session adminSession
	return session, json.Unmarshal(raw, &session)
}

func hmacSHA256Hex(key []byte, value string) string {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func randomToken(n int) string {
	if n <= 0 {
		n = 24
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func (a *API) setCookie(c *gin.Context, name, value string, maxAge time.Duration) {
	secure := a.secureCookie(c)
	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		SameSite: a.sessionSameSite(secure),
		Secure:   secure,
	}
	if domain := strings.TrimSpace(a.app.Config.SessionCookieDomain); domain != "" {
		cookie.Domain = domain
	}
	http.SetCookie(c.Writer, cookie)
}

func (a *API) clearCookie(c *gin.Context, name string) {
	secure := a.secureCookie(c)
	cookie := &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: a.sessionSameSite(secure),
		Secure:   secure,
	}
	if domain := strings.TrimSpace(a.app.Config.SessionCookieDomain); domain != "" {
		cookie.Domain = domain
	}
	http.SetCookie(c.Writer, cookie)
}

func (a *API) secureCookie(c *gin.Context) bool {
	return c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

func (a *API) sessionSameSite(secure bool) http.SameSite {
	if secure && frontendBackendHostsDiffer(a.app.Config.WebBaseURL, a.app.Config.PublicBaseURL) {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
}

func frontendBackendHostsDiffer(frontendURL, backendURL string) bool {
	frontendHost := parsedHostname(frontendURL)
	backendHost := parsedHostname(backendURL)
	return frontendHost != "" && backendHost != "" && !strings.EqualFold(frontendHost, backendHost)
}

func parsedHostname(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return strings.ToLower(parsed.Hostname())
}

func (a *API) frontendLoginURL(errorCode string) string {
	base := firstNonEmpty(a.app.Config.WebBaseURL, a.app.Config.PublicBaseURL)
	path := strings.TrimRight(base, "/") + "/login"
	if strings.TrimSpace(errorCode) != "" {
		path += "?error=" + strings.TrimSpace(errorCode)
	}
	return path
}

func (a *API) frontendClientURL(errorCode string) string {
	base := firstNonEmpty(a.app.Config.WebBaseURL, a.app.Config.PublicBaseURL)
	path := strings.TrimRight(base, "/") + "/client"
	if strings.TrimSpace(errorCode) != "" {
		path += "?error=" + strings.TrimSpace(errorCode)
	}
	return path
}

func (a *API) safeFrontendReturnTo(raw string) string {
	return a.safeFrontendReturnToDefault(raw, "/admin")
}

func (a *API) safeFrontendReturnToDefault(raw, defaultPath string) string {
	base := strings.TrimRight(firstNonEmpty(a.app.Config.WebBaseURL, a.app.Config.PublicBaseURL), "/")
	if base == "" {
		base = "/"
	}
	if strings.TrimSpace(defaultPath) == "" || !strings.HasPrefix(defaultPath, "/") || strings.HasPrefix(defaultPath, "//") {
		defaultPath = "/admin"
	}
	value := strings.TrimSpace(raw)
	if value == "" {
		return strings.TrimRight(base, "/") + defaultPath
	}
	if strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//") {
		return strings.TrimRight(base, "/") + value
	}
	if strings.HasPrefix(strings.TrimRight(value, "/"), base) {
		return value
	}
	return strings.TrimRight(base, "/") + defaultPath
}
