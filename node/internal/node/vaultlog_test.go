package node

import (
	"testing"
	"time"
)

func TestVaultOpSignatureAndTamperDetection(t *testing.T) {
	home := t.TempDir()
	identity, err := ensureDeviceIdentity(home)
	if err != nil {
		t.Fatal(err)
	}
	file := DemoFile{
		ID:         "file-1",
		Name:       "hello.txt",
		CID:        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ge7qj3uqz2cvz7k4z2x7c4nq",
		Size:       42,
		Visibility: "public",
		AddedAt:    time.Now().UTC(),
	}
	op, err := identity.signOp(VaultOp{Type: vaultOpFileAdd, File: &file})
	if err != nil {
		t.Fatal(err)
	}
	if err := verifyVaultOp(op); err != nil {
		t.Fatalf("verify signed op: %v", err)
	}

	tampered := op
	copyFile := *tampered.File
	copyFile.Name = "evil.txt"
	tampered.File = &copyFile
	if err := verifyVaultOp(tampered); err == nil {
		t.Fatal("expected tampered op to fail verification")
	}
}

func TestApplyVaultOpsAndReplicaReceipts(t *testing.T) {
	identityA, err := ensureDeviceIdentity(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	identityB, err := ensureDeviceIdentity(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	file := DemoFile{
		ID:         "file-1",
		Name:       "hello.txt",
		CID:        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ge7qj3uqz2cvz7k4z2x7c4nq",
		Size:       42,
		Visibility: "public",
		AddedAt:    time.Now().UTC(),
	}
	add, err := identityA.signOp(VaultOp{Type: vaultOpFileAdd, PeerID: "peer-a", File: &file})
	if err != nil {
		t.Fatal(err)
	}
	ackA, err := identityA.signOp(VaultOp{Type: vaultOpReplicaAck, PeerID: "peer-a", FileID: file.ID, CID: file.CID})
	if err != nil {
		t.Fatal(err)
	}
	ackB, err := identityB.signOp(VaultOp{Type: vaultOpReplicaAck, PeerID: "peer-b", FileID: file.ID, CID: file.CID})
	if err != nil {
		t.Fatal(err)
	}

	ops, changed, err := mergeVerifiedOps(nil, []VaultOp{add, ackA, ackB})
	if err != nil {
		t.Fatal(err)
	}
	if !changed || len(ops) != 3 {
		t.Fatalf("unexpected merged ops: changed=%v len=%d", changed, len(ops))
	}

	files := applyVaultOps(nil, ops)
	if len(files) != 1 || files[0].ID != file.ID {
		t.Fatalf("unexpected files: %#v", files)
	}

	receipts := replicaReceiptsFor(ops, file.ID, file.CID)
	if len(receipts) != 2 {
		t.Fatalf("expected two distinct replica receipts, got %d", len(receipts))
	}

	remove, err := identityA.signOp(VaultOp{Type: vaultOpFileRemove, PeerID: "peer-a", FileID: file.ID})
	if err != nil {
		t.Fatal(err)
	}
	files = applyVaultOps(files, append(ops, remove))
	if len(files) != 0 {
		t.Fatalf("expected file removal, got %#v", files)
	}
}
