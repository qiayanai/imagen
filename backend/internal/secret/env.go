package secret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

type EnvBox struct {
	secret string
}

type envelope struct {
	Encrypted bool              `json:"encrypted"`
	Version   int               `json:"version"`
	Items     map[string]string `json:"items"`
}

func NewEnvBox(secret string) *EnvBox {
	return &EnvBox{secret: secret}
}

func (b *EnvBox) SealMap(env map[string]string) []byte {
	clean := map[string]string{}
	for key, value := range env {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		clean[key] = value
	}
	if len(clean) == 0 {
		return mustJSON(map[string]string{})
	}
	items := map[string]string{}
	for key, value := range clean {
		encrypted, err := b.encrypt(value)
		if err != nil {
			continue
		}
		items[key] = encrypted
	}
	return mustJSON(envelope{Encrypted: true, Version: 1, Items: items})
}

func (b *EnvBox) OpenMap(raw []byte) map[string]string {
	out := map[string]string{}
	if len(raw) == 0 {
		return out
	}
	var wrapped envelope
	if err := json.Unmarshal(raw, &wrapped); err == nil && wrapped.Encrypted {
		for key, value := range wrapped.Items {
			decrypted, err := b.decrypt(value)
			if err == nil {
				out[key] = decrypted
			}
		}
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func EnvKeys(raw []byte) []string {
	keys := map[string]string{}
	if len(raw) == 0 {
		return nil
	}
	var wrapped envelope
	if err := json.Unmarshal(raw, &wrapped); err == nil && wrapped.Encrypted {
		keys = wrapped.Items
	} else {
		_ = json.Unmarshal(raw, &keys)
	}
	out := make([]string, 0, len(keys))
	for key := range keys {
		out = append(out, key)
	}
	return out
}

func (b *EnvBox) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(secretKey(b.secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawURLEncoding.EncodeToString(ciphertext), nil
}

func (b *EnvBox) decrypt(ciphertext string) (string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(ciphertext))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(secretKey(b.secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, body := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, body, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func secretKey(secret string) []byte {
	sum := sha256.Sum256([]byte(strings.TrimSpace(secret)))
	return sum[:]
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}
