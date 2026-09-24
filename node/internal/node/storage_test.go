package node

import "testing"

func TestNormalizeStorage(t *testing.T) {
	tests := map[string]string{
		"100GB":  "100GB",
		"2tb":    "2TB",
		"512MiB": "512MIB",
	}

	for input, want := range tests {
		got, err := normalizeStorage(input)
		if err != nil {
			t.Fatalf("normalizeStorage(%q): %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeStorage(%q) = %q, want %q", input, got, want)
		}
	}

	for _, invalid := range []string{"", "0GB", "-1GB", "100", "1.5TB", "wat"} {
		if _, err := normalizeStorage(invalid); err == nil {
			t.Fatalf("normalizeStorage(%q) should fail", invalid)
		}
	}
}

func TestValidateIPFSPath(t *testing.T) {
	got, err := validateIPFSPath("bafytest")
	if err != nil {
		t.Fatal(err)
	}
	if got != "/ipfs/bafytest" {
		t.Fatalf("got %q", got)
	}

	got, err = validateIPFSPath("/ipfs/bafytest")
	if err != nil {
		t.Fatal(err)
	}
	if got != "/ipfs/bafytest" {
		t.Fatalf("got %q", got)
	}

	if _, err := validateIPFSPath("bafy bad"); err == nil {
		t.Fatal("expected whitespace rejection")
	}
}

func TestLineHelpers(t *testing.T) {
	input := "peer1\n\npeer2\n"
	lines := splitNonEmptyLines(input)
	if len(lines) != 2 || lines[0] != "peer1" || lines[1] != "peer2" {
		t.Fatalf("unexpected lines: %#v", lines)
	}
	if countNonEmptyLines(input) != 2 {
		t.Fatalf("unexpected line count")
	}
}
