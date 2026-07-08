package runner

import (
	"strings"
	"testing"
)

func TestBuildPromptIncludesExplicitCanvasRequirement(t *testing.T) {
	prompt := buildPrompt(execOptions{
		Prompt:     "A cinematic product image",
		ImageCount: 1,
		OutputDir:  "/tmp/imagen/task_test",
		Options: GenerationOptions{
			Size: "1024x1536",
		},
	})

	for _, want := range []string{
		"- size: 1024x1536",
		"The final image canvas MUST be 1024x1536 pixels",
		"portrait orientation",
		"Do not substitute a square canvas",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt does not contain %q:\n%s", want, prompt)
		}
	}
}
