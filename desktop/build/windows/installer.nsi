Unicode true

!include "MUI2.nsh"

!ifndef APP_EXE
  !error "APP_EXE define is required"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "0.3.0"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "13xfile-${APP_VERSION}-setup.exe"
!endif
!ifndef WEBVIEW2_BOOTSTRAPPER
  !error "WEBVIEW2_BOOTSTRAPPER define is required"
!endif

!define PRODUCT_NAME "13xfile"
!define PRODUCT_EXE "13xfile.exe"
!define PRODUCT_ID "app.13xfile.desktop"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\13xfile"
!define PROTOCOL_KEY "Software\Classes\x13file"

Name "${PRODUCT_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\13xfile"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ManifestDPIAware true

VIProductVersion "${APP_VERSION}.0"
VIFileVersion "${APP_VERSION}.0"
VIAddVersionKey "CompanyName" "13xfile"
VIAddVersionKey "FileDescription" "13xfile Installer"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductName" "13xfile"
VIAddVersionKey "LegalCopyright" "(c) 2026 13xfile"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch 13xfile"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "13xfile" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"

  File "/oname=${PRODUCT_EXE}" "${APP_EXE}"
  File "/oname=MicrosoftEdgeWebview2Setup.exe" "${WEBVIEW2_BOOTSTRAPPER}"

  ; Evergreen bootstrapper is idempotent and exits quickly when WebView2 exists.
  ExecWait '"$INSTDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'
  Delete "$INSTDIR\MicrosoftEdgeWebview2Setup.exe"

  ; x13file://share/... deep-link registration.
  WriteRegStr HKCU "${PROTOCOL_KEY}" "" "URL:13xfile Protocol"
  WriteRegStr HKCU "${PROTOCOL_KEY}" "URL Protocol" ""
  WriteRegStr HKCU "${PROTOCOL_KEY}\DefaultIcon" "" '"$INSTDIR\${PRODUCT_EXE}",0'
  WriteRegStr HKCU "${PROTOCOL_KEY}\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'

  CreateDirectory "$SMPROGRAMS\13xfile"
  CreateShortcut "$SMPROGRAMS\13xfile\13xfile.lnk" "$INSTDIR\${PRODUCT_EXE}"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "13xfile"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "13xfile"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "13xfile"
  DeleteRegKey HKCU "${PROTOCOL_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"

  Delete "$SMPROGRAMS\13xfile\13xfile.lnk"
  RMDir "$SMPROGRAMS\13xfile"

  Delete "$INSTDIR\${PRODUCT_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  ; Intentionally preserve %USERPROFILE%\.13xfile-desktop.
  ; Removing the application must never silently delete vault keys or local replicas.
SectionEnd
