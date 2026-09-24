package node

import "testing"

func TestKuboArchive(t *testing.T) {
	tests := []struct {
		goos string
		arch string
		want string
		kind string
	}{
		{"windows", "amd64", "kubo_v0.43.1_windows-amd64.zip", "zip"},
		{"windows", "arm64", "kubo_v0.43.1_windows-arm64.zip", "zip"},
		{"linux", "amd64", "kubo_v0.43.1_linux-amd64.tar.gz", "tar.gz"},
		{"linux", "arm64", "kubo_v0.43.1_linux-arm64.tar.gz", "tar.gz"},
		{"darwin", "amd64", "kubo_v0.43.1_darwin-amd64.tar.gz", "tar.gz"},
		{"darwin", "arm64", "kubo_v0.43.1_darwin-arm64.tar.gz", "tar.gz"},
	}

	for _, tc := range tests {
		got, kind, err := kuboArchive(tc.goos, tc.arch)
		if err != nil {
			t.Fatalf("%s/%s: %v", tc.goos, tc.arch, err)
		}
		if got != tc.want || kind != tc.kind {
			t.Fatalf("%s/%s = %q %q; want %q %q", tc.goos, tc.arch, got, kind, tc.want, tc.kind)
		}
	}

	if _, _, err := kuboArchive("plan9", "amd64"); err == nil {
		t.Fatal("expected unsupported OS to fail")
	}
}
