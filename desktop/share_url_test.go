package main

import "testing"

func TestPublicWebShareURL(t *testing.T) {
	cases := []struct {
		name, setting, want string
	}{
		{"default", "", publicWebShareBase},
		{"production", "https://share.13xfile.app/", "https://share.13xfile.app"},
		{"local", "http://127.0.0.1:8082/", "http://127.0.0.1:8082"},
		{"reject insecure remote", "http://example.com", publicWebShareBase},
		{"reject query", "https://share.13xfile.app/?redirect=1", publicWebShareBase},
		{"reject credentials", "https://user:password@share.13xfile.app", publicWebShareBase},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("WEB_SHARE_BASE_URL", tt.setting)
			if got := publicWebShareURL(); got != tt.want {
				t.Fatalf("publicWebShareURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
