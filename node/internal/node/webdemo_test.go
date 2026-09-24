package node

import (
	"strings"
	"testing"
)

func TestShareDescriptorRoundTrip(t *testing.T) {
	file := DemoFile{
		Name: "hello world.txt",
		CID:  "Qmav5KLGGGTEB7iiEJ4WFH1Be2s6WfotEhLNK1T9fiD6XG",
		Size: 194,
		MIME: "text/plain",
	}
	encoded := encodeShare(file)
	if !strings.HasPrefix(encoded, "13xfile://share/") {
		t.Fatalf("unexpected descriptor: %s", encoded)
	}

	decoded, err := decodeShare(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Name != file.Name || decoded.CID != file.CID || decoded.Size != file.Size || decoded.MIME != file.MIME {
		t.Fatalf("round trip mismatch: %#v", decoded)
	}
}

func TestShareDescriptorRejectsGarbage(t *testing.T) {
	if _, err := decodeShare("not-a-share"); err == nil {
		t.Fatal("expected invalid descriptor to fail")
	}
}
