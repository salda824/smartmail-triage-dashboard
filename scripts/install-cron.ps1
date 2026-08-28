<#
.SYNOPSIS
  Registra la sincronizacion diaria de SmartMail Triage en el Programador de
  tareas de Windows.

.DESCRIPTION
  Crea una tarea que ejecuta `npm run sync` una vez al dia. La tarea corre en la
  sesion del usuario actual (no necesita administrador) y se pone al dia si el
  equipo estaba apagado a la hora programada.

.PARAMETER Time
  Hora de ejecucion en formato HH:mm. Por defecto 08:00.

.PARAMETER TaskName
  Nombre de la tarea. Por defecto "SmartMailTriage-DailySync".

.PARAMETER Remove
  Elimina la tarea en lugar de crearla.

.EXAMPLE
  npm run cron:install
  npm run cron:install -- -Time 07:30
  npm run cron:install -- -Remove
#>

[CmdletBinding()]
param(
    [string]$Time = '08:00',
    [string]$TaskName = 'SmartMailTriage-DailySync',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

# La raiz del proyecto es el directorio padre de /scripts.
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if ($Remove) {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Output "Tarea '$TaskName' eliminada."
    } else {
        Write-Output "La tarea '$TaskName' no existe; no hay nada que eliminar."
    }
    return
}

if ($Time -notmatch '^([01]\d|2[0-3]):[0-5]\d$') {
    throw "Hora invalida: '$Time'. Usa el formato HH:mm, por ejemplo 08:00."
}

# Se invoca node.exe por su ruta absoluta, no `npm run sync`. Dos motivos: la
# tarea programada no hereda el PATH de la sesion, asi que `npm` no encontraria
# `node`; y `cmd /c` destroza las comillas cuando la orden empieza por una, de
# modo que la redireccion al log se perdia. El propio script escribe el log
# con `--log`.
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) {
    $node = 'C:\Program Files\nodejs\node.exe'
}
if (-not $node) { throw 'No se encontro node.exe. Instala Node.js o anadelo al PATH.' }

$tsx = Join-Path $ProjectRoot 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { throw "No se encontro tsx en $tsx. Ejecuta npm install." }

$logDir = Join-Path $ProjectRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir 'sync.log'

$action = New-ScheduledTaskAction -Execute $node `
    -Argument "`"$tsx`" `"$(Join-Path $ProjectRoot 'scripts\sync.ts')`" --log" `
    -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew

# Interactive corre en la sesion del usuario y, a diferencia de S4U, no exige
# privilegios de administrador para registrar la tarea. A cambio la
# sincronizacion solo se ejecuta con la sesion iniciada; -StartWhenAvailable
# hace que se ponga al dia en cuanto el usuario vuelve.
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Output "Tarea previa '$TaskName' reemplazada."
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'Sincroniza y clasifica los correos de Gmail en SmartMail Triage.' | Out-Null

Write-Output ''
Write-Output "Tarea '$TaskName' registrada."
Write-Output "  Hora        : todos los dias a las $Time"
Write-Output "  Directorio  : $ProjectRoot"
Write-Output "  Log         : $logFile"
Write-Output ''
Write-Output 'Para probarla de inmediato:'
Write-Output "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Output 'Para eliminarla:'
Write-Output '  npm run cron:install -- -Remove'
