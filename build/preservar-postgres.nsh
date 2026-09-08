; Preserva o runtime PostgreSQL durante a troca do aplicativo.
; Mantém a estratégia de mover/restaurar arquivos usada pelo electron-builder.
!macro customRemoveFiles
  ${If} ${isUpdated}
    InitPluginsDir
    CreateDirectory "$PLUGINSDIR\old-install"
    Push ""
    Call un.estrudenaAtomicRMDir
    Pop $R0
    ${If} $R0 != 0
      Push ""
      Call un.restoreFiles
      Pop $R0
      Abort "Não foi possível atualizar. Feche o aplicativo e tente novamente."
    ${EndIf}
  ${Else}
    RMDir /r $INSTDIR
  ${EndIf}
!macroend
Function un.estrudenaAtomicRMDir
  Exch $R0
  Push $R1
  Push $R2
  Push $R3

  StrCpy $R3 "$INSTDIR$R0\*.*"
  FindFirst $R1 $R2 $R3

  loop:
    StrCmp $R2 "" break

    StrCmp $R2 "." continue
    StrCmp $R2 ".." continue
    StrCmp "$R0\$R2" "\resources\pgsql" continue

    IfFileExists "$INSTDIR$R0\$R2\*.*" isDir isNotDir

    isDir:
      CreateDirectory "$PLUGINSDIR\old-install$R0\$R2"

      Push "$R0\$R2"
      Call un.estrudenaAtomicRMDir
      Pop $R3

      ${if} $R3 != 0
        Goto done
      ${endIf}

      Goto continue

    isNotDir:
      ClearErrors
      Rename "$INSTDIR$R0\$R2" "$PLUGINSDIR\old-install$R0\$R2"

      # Ignore errors when renaming ourselves.
      StrCmp "$R0\$R2" "\Uninstall ${PRODUCT_FILENAME}.exe" 0 +2
      ClearErrors

      IfErrors 0 +3
      StrCpy $R3 "$INSTDIR$R0\$R2"
      Goto done

    continue:
      FindNext $R1 $R2
      Goto loop

  break:
    StrCpy $R3 0

  done:
    FindClose $R1

    StrCpy $R0 $R3

    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd
