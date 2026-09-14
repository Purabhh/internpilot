' intern.pilot silent launcher.
' Runs launch.bat with a fully hidden console so the ONLY window you ever see
' is the app itself (Chrome app-mode). This is the target of the Desktop /
' Start Menu shortcut; you can also double-click it directly.
Option Explicit
Dim fso, sh, here
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
' 0 = hidden window, False = return immediately (launch.bat supervises itself).
sh.Run """" & here & "\launch.bat""", 0, False
