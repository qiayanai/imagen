package runner

import (
	"os"
	"path/filepath"
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

func TestBuildPromptMakesImageGenerationExplicit(t *testing.T) {
	prompt := buildPrompt(execOptions{
		Prompt:     "A cinematic product image",
		ImageCount: 1,
		OutputDir:  "/tmp/imagen/task_test",
	})

	for _, want := range []string{
		"This is an IMAGE GENERATION task",
		"You must create actual raster image files",
		"Use the available image generation capability/tool now",
		"Before printing the final result line, verify that every image path exists on disk",
		resultMarker,
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt does not contain %q:\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "/absolute/path/1.png") {
		t.Fatalf("prompt still contains placeholder image path:\n%s", prompt)
	}
}

func TestBuildPromptIncludesRetryContext(t *testing.T) {
	prompt := buildPrompt(execOptions{
		Prompt:        "A cinematic product image",
		ImageCount:    1,
		OutputDir:     "/tmp/imagen/task_test",
		Attempt:       2,
		MaxAttempts:   3,
		PreviousError: "no local image output",
	})

	for _, want := range []string{
		"Retry context:",
		"retry attempt 2 of 3",
		"Previous failure: no local image output",
		"Do not repeat or summarize image-generation documentation",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("retry prompt does not contain %q:\n%s", want, prompt)
		}
	}
}

func TestCandidateImagePathsPreservesNonExistingMarkerPaths(t *testing.T) {
	output := resultMarker + `<images>/tmp/missing-a.png,/tmp/missing-b.webp</images>`
	got := candidateImagePaths(output)
	if len(got) != 2 || got[0] != "/tmp/missing-a.png" || got[1] != "/tmp/missing-b.webp" {
		t.Fatalf("candidateImagePaths() = %#v", got)
	}
}

func TestScanImagesFindsNestedOutputFiles(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "nested")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatalf("mkdir nested: %v", err)
	}
	imagePath := filepath.Join(nested, "task_test-1.png")
	if err := os.WriteFile(imagePath, []byte("png"), 0o644); err != nil {
		t.Fatalf("write image: %v", err)
	}

	got := scanImages(root)
	if len(got) != 1 || got[0] != imagePath {
		t.Fatalf("scanImages() = %#v, want %q", got, imagePath)
	}
}
