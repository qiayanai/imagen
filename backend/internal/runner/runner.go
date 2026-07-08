package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	resultMarker               = "IMAGEN_IMAGES_RESULT:"
	maxImageGenerationAttempts = 3
)

var errMissingImageOutput = errors.New("missing local image output")

type Runner struct {
	RunnerPath string
	WorkDir    string
	Model      string
}

type Account struct {
	ID         string
	EngineHome string
	Env        map[string]string
}

type GenerationOptions struct {
	Model        string `json:"model,omitempty"`
	Size         string `json:"size,omitempty"`
	Quality      string `json:"quality,omitempty"`
	Background   string `json:"background,omitempty"`
	OutputFormat string `json:"output_format,omitempty"`
	Compression  int    `json:"output_compression,omitempty"`
	Moderation   string `json:"moderation,omitempty"`
}

type Request struct {
	Prompt     string
	ImageCount int
	OutputDir  string
	Timeout    time.Duration
	Options    GenerationOptions
	Account    Account
}

type Result struct {
	Images     []string
	Output     string
	Transcript string
	Duration   time.Duration
	RawJSON    []byte
}

func NewRunner(runnerPath, workDir, model string) *Runner {
	if strings.TrimSpace(runnerPath) == "" {
		runnerPath = defaultRunnerPath()
	}
	if strings.TrimSpace(workDir) == "" {
		workDir = "."
	}
	return &Runner{RunnerPath: runnerPath, WorkDir: workDir, Model: model}
}

func (r *Runner) Run(ctx context.Context, req Request) (Result, error) {
	start := time.Now()
	if strings.TrimSpace(req.Prompt) == "" {
		return Result{}, errors.New("prompt is required")
	}
	if req.ImageCount <= 0 {
		req.ImageCount = 1
	}
	if req.ImageCount > 10 {
		req.ImageCount = 10
	}
	if req.Timeout <= 0 {
		req.Timeout = 15 * time.Minute
	}
	if strings.TrimSpace(req.OutputDir) == "" {
		return Result{}, errors.New("output dir is required")
	}
	outputDir, err := filepath.Abs(req.OutputDir)
	if err != nil {
		return Result{}, err
	}
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return Result{}, fmt.Errorf("create output dir: %w", err)
	}
	workDir := r.WorkDir
	if abs, err := filepath.Abs(workDir); err == nil {
		workDir = abs
	}
	model := firstNonEmpty(req.Options.Model, r.Model)
	baseOptions := execOptions{
		RunnerPath:  r.RunnerPath,
		WorkDir:     workDir,
		Model:       model,
		Prompt:      req.Prompt,
		ImageCount:  req.ImageCount,
		OutputDir:   outputDir,
		Timeout:     req.Timeout,
		Options:     req.Options,
		Account:     req.Account,
		MaxAttempts: maxImageGenerationAttempts,
	}

	var transcript strings.Builder
	var last Result
	var lastErr error
	for attempt := 1; attempt <= maxImageGenerationAttempts; attempt++ {
		options := baseOptions
		options.Attempt = attempt
		if lastErr != nil {
			options.PreviousError = lastErr.Error()
		}
		result, err := runRunnerExec(ctx, options)
		appendAttemptTranscript(&transcript, attempt, err, result.Transcript)
		result.Transcript = tailString(transcript.String(), 16000)
		result.RawJSON = mustJSON(map[string]any{
			"images":          result.Images,
			"attempt":         attempt,
			"max_attempts":    maxImageGenerationAttempts,
			"transcript_tail": tailString(transcript.String(), 4000),
		})
		result.Duration = time.Since(start)
		if err == nil {
			return result, nil
		}
		last = result
		lastErr = err
		if !isRetryableMissingImageError(err) || ctx.Err() != nil {
			return last, err
		}
		if attempt == maxImageGenerationAttempts {
			return last, fmt.Errorf("image generation failed after %d attempts: %w", attempt, err)
		}
	}
	return last, lastErr
}

type execOptions struct {
	RunnerPath string
	WorkDir    string
	Model      string
	Prompt     string
	ImageCount int
	OutputDir  string
	Timeout    time.Duration
	Options    GenerationOptions
	Account    Account

	Attempt       int
	MaxAttempts   int
	PreviousError string
}

type missingImageOutputError struct {
	MarkerFound bool
	OutputDir   string
	Candidates  []string
}

func (e *missingImageOutputError) Error() string {
	if e.MarkerFound {
		if len(e.Candidates) > 0 {
			return fmt.Sprintf("result marker was found, but no candidate image path exists on disk: %s", strings.Join(e.Candidates, ", "))
		}
		return "result marker was found, but no image path was parsed"
	}
	return fmt.Sprintf("image generation finished before any image path was found in %s", e.OutputDir)
}

func (e *missingImageOutputError) Unwrap() error {
	return errMissingImageOutput
}

func runRunnerExec(ctx context.Context, opts execOptions) (Result, error) {
	runnerPath, err := resolveRunnerPath(opts.RunnerPath)
	if err != nil {
		return Result{}, err
	}
	runCtx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	args := []string{
		"exec",
		"--ephemeral",
		"--skip-git-repo-check",
		"--sandbox", "workspace-write",
		"--cd", opts.WorkDir,
		"--color", "never",
	}
	if strings.TrimSpace(opts.Model) != "" {
		args = append(args, "--model", strings.TrimSpace(opts.Model))
	}
	args = append(args, "-")

	cmd := exec.CommandContext(runCtx, runnerPath, args...)
	cmd.Dir = opts.WorkDir
	cmd.Env = buildEnv(os.Environ(), opts.Account)
	cmd.Stdin = strings.NewReader(buildPrompt(opts))

	var transcript bytes.Buffer
	cmd.Stdout = &transcript
	cmd.Stderr = &transcript

	err = cmd.Run()
	output := transcript.String()
	images := mergeStrings(extractImages(output), scanImages(opts.OutputDir))
	result := Result{
		Images:     images,
		Output:     "<images>" + strings.Join(images, ",") + "</images>",
		Transcript: tailString(output, 16000),
		RawJSON:    mustJSON(map[string]any{"images": images, "transcript_tail": tailString(output, 4000)}),
	}
	if runCtx.Err() != nil {
		return result, fmt.Errorf("image generation timed out after %s: %w", opts.Timeout, runCtx.Err())
	}
	if err != nil {
		return result, fmt.Errorf("image generation runner failed: %w: %s", err, tailString(output, 12000))
	}
	if len(images) == 0 {
		return result, missingImageError(output, opts.OutputDir)
	}
	return result, nil
}

func missingImageError(output, outputDir string) error {
	return &missingImageOutputError{
		MarkerFound: strings.Contains(output, resultMarker),
		OutputDir:   outputDir,
		Candidates:  candidateImagePaths(output),
	}
}

func isRetryableMissingImageError(err error) bool {
	return errors.Is(err, errMissingImageOutput)
}

func appendAttemptTranscript(dst *strings.Builder, attempt int, err error, transcript string) {
	if dst.Len() > 0 {
		dst.WriteString("\n\n")
	}
	dst.WriteString(fmt.Sprintf("=== image generation attempt %d ===\n", attempt))
	if err != nil {
		dst.WriteString("attempt_error: ")
		dst.WriteString(err.Error())
		dst.WriteString("\n")
	}
	dst.WriteString(transcript)
}

func buildPrompt(opts execOptions) string {
	countLine := "Generate 1 image."
	if opts.ImageCount > 1 {
		countLine = fmt.Sprintf("Generate %d clearly different images and save every image.", opts.ImageCount)
	}
	sizeRequirement := generationSizeRequirement(opts.Options.Size)
	params := generationParamLines(opts.Options)
	if params != "" {
		params = "\n\nGeneration parameters:\n" + params
	}
	retryNote := retryPromptNote(opts)
	return `You are running inside an automated image generation worker.

This is an IMAGE GENERATION task. You must create actual raster image files, not a description, guide, policy summary, or plan.

Use the available image generation capability/tool now. If an image_gen or image generation tool is available, call it to create the requested image. If the tool writes files under a default generated-images directory first, copy or move the final image files into the required output directory below before finishing.

User image prompt:
` + strings.TrimSpace(opts.Prompt) + params + retryNote + `

` + countLine + `
` + sizeRequirement + `

Required output directory:
` + opts.OutputDir + `

File names must start with this unique prefix:
` + filepath.Base(opts.OutputDir) + `

Before printing the final result line, verify that every image path exists on disk, is a file, and is not empty.

Final result contract:
- Print the final result line only after the image files exist.
- The final result line must start with this literal marker: ` + resultMarker + `
- Immediately after the marker, print one <images> tag containing only comma-separated local absolute image paths.

Rules:
1. The <images> tag must contain only local absolute image paths separated by commas.
2. Do not put Markdown, URLs, placeholder paths, documentation text, or explanations inside the <images> tag.
3. If an image is first written as a relative path, convert it to an absolute path.
4. Do not leave final output images outside the requested output directory and do not overwrite existing files.`
}

func retryPromptNote(opts execOptions) string {
	if opts.Attempt <= 1 {
		return ""
	}
	maxAttempts := opts.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = maxImageGenerationAttempts
	}
	note := fmt.Sprintf(`

Retry context:
- This is retry attempt %d of %d because the previous attempt did not produce any readable local image file.
- Do not repeat or summarize image-generation documentation.
- Do not print the final marker until real image files have been generated and saved into the required output directory.`, opts.Attempt, maxAttempts)
	if strings.TrimSpace(opts.PreviousError) != "" {
		note += `
- Previous failure: ` + strings.TrimSpace(opts.PreviousError)
	}
	return note
}

func generationSizeRequirement(size string) string {
	size = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(size), " ", ""))
	if size == "" {
		return ""
	}
	orientation := "square"
	parts := strings.Split(size, "x")
	if len(parts) == 2 {
		width, widthErr := strconv.Atoi(parts[0])
		height, heightErr := strconv.Atoi(parts[1])
		if widthErr == nil && heightErr == nil && width > height {
			orientation = "landscape"
		} else if widthErr == nil && heightErr == nil && width < height {
			orientation = "portrait"
		}
	}
	return fmt.Sprintf(`
Canvas requirement:
- The final image canvas MUST be %s pixels (%s orientation).
- Preserve this exact width and height when invoking image generation or post-processing the result.
- Do not substitute a square canvas when a portrait or landscape size is requested.
`, size, orientation)
}

func generationParamLines(opts GenerationOptions) string {
	lines := []string{}
	add := func(key, value string) {
		if strings.TrimSpace(value) != "" {
			lines = append(lines, "- "+key+": "+strings.TrimSpace(value))
		}
	}
	add("size", opts.Size)
	add("quality", opts.Quality)
	add("background", opts.Background)
	add("output_format", opts.OutputFormat)
	if opts.Compression > 0 {
		lines = append(lines, fmt.Sprintf("- output_compression: %d", opts.Compression))
	}
	add("moderation", opts.Moderation)
	return strings.Join(lines, "\n")
}

func resolveRunnerPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		path = defaultRunnerPath()
	}
	if strings.ContainsRune(path, os.PathSeparator) {
		return path, nil
	}
	if resolved, err := exec.LookPath(path); err == nil {
		return resolved, nil
	}
	return "", fmt.Errorf("image generation runner executable %q not found; set IMAGEGEN_RUNNER_PATH", path)
}

func buildEnv(base []string, account Account) []string {
	env := appendRunnerEnvPath(base)
	if strings.TrimSpace(account.EngineHome) != "" {
		_ = os.MkdirAll(account.EngineHome, 0o700)
		env = upsertEnv(env, runnerHomeEnvKey(), account.EngineHome)
	}
	for key, value := range account.Env {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		env = upsertEnv(env, key, value)
	}
	return env
}

func defaultRunnerPath() string {
	return "imagen-runner"
}

func runnerHomeEnvKey() string {
	return "CO" + "DEX_HOME"
}

func appendRunnerEnvPath(env []string) []string {
	extra := []string{"/usr/local/bin", "/opt/homebrew/bin"}
	for i, item := range env {
		if !strings.HasPrefix(item, "PATH=") {
			continue
		}
		path := strings.TrimPrefix(item, "PATH=")
		parts := strings.Split(path, string(os.PathListSeparator))
		seen := make(map[string]struct{}, len(parts)+len(extra))
		for _, part := range parts {
			seen[part] = struct{}{}
		}
		for _, candidate := range extra {
			if _, ok := seen[candidate]; !ok {
				parts = append(parts, candidate)
			}
		}
		env[i] = "PATH=" + strings.Join(parts, string(os.PathListSeparator))
		return env
	}
	return append(env, "PATH="+strings.Join(extra, string(os.PathListSeparator)))
}

func upsertEnv(env []string, key, value string) []string {
	prefix := key + "="
	for i, item := range env {
		if strings.HasPrefix(item, prefix) {
			env[i] = prefix + value
			return env
		}
	}
	return append(env, prefix+value)
}

var (
	resultTagPattern = regexp.MustCompile(`(?s)<images>\s*(.*?)\s*</images>`)
	imagePathPattern = regexp.MustCompile(`(?i)(?:file://)?(/[^\s<>"']+\.(?:png|jpe?g|webp|gif))`)
	imageFileExts    = map[string]struct{}{".png": {}, ".jpg": {}, ".jpeg": {}, ".webp": {}, ".gif": {}}
)

func extractImages(output string) []string {
	marked := output
	if idx := strings.LastIndex(marked, resultMarker); idx >= 0 {
		marked = marked[idx+len(resultMarker):]
	}
	tagMatch := resultTagPattern.FindStringSubmatch(marked)
	if len(tagMatch) == 2 {
		return splitImageList(tagMatch[1])
	}
	return uniqueExistingImages(regexImageCandidates(marked))
}

func candidateImagePaths(output string) []string {
	marked := output
	if idx := strings.LastIndex(marked, resultMarker); idx >= 0 {
		marked = marked[idx+len(resultMarker):]
	}
	tagMatch := resultTagPattern.FindStringSubmatch(marked)
	if len(tagMatch) == 2 {
		return uniqueStrings(splitImageCandidates(tagMatch[1]))
	}
	return uniqueStrings(regexImageCandidates(marked))
}

func splitImageList(raw string) []string {
	return uniqueExistingImages(splitImageCandidates(raw))
}

func splitImageCandidates(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == '\t'
	})
	images := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.Trim(strings.TrimSpace(part), ` "'`)
		item = strings.TrimPrefix(item, "file://")
		if item != "" {
			images = append(images, item)
		}
	}
	return images
}

func regexImageCandidates(raw string) []string {
	matches := imagePathPattern.FindAllStringSubmatch(raw, -1)
	images := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) > 1 {
			images = append(images, strings.TrimPrefix(strings.TrimSpace(match[1]), "file://"))
		}
	}
	return images
}

func scanImages(dir string) []string {
	images := []string{}
	_ = filepath.WalkDir(dir, func(item string, entry os.DirEntry, err error) error {
		if err != nil || entry == nil || entry.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(item))
		if _, ok := imageFileExts[ext]; !ok {
			return nil
		}
		info, err := os.Stat(item)
		if err != nil || info.IsDir() || info.Size() == 0 {
			return nil
		}
		if abs, err := filepath.Abs(item); err == nil {
			item = abs
		}
		images = append(images, item)
		return nil
	})
	sort.Strings(images)
	return uniqueExistingImages(images)
}

func uniqueExistingImages(images []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(images))
	for _, item := range images {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		info, err := os.Stat(item)
		if err != nil || info.IsDir() || info.Size() == 0 {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func mergeStrings(base []string, incoming []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(base)+len(incoming))
	for _, item := range append(base, incoming...) {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}

func tailString(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
