param (
  [string] $dbIp,
  [string] $dbName,
  [String] $dbUser,
  [string] $dbPass,
  [String] $folder
)

function Is-Numeric ($Value) {
    return $Value -match "^[\d\.]+$"
}

Function ConvertTo-UnixTimeNanosecond ($timestamp) {
  return [long]((New-TimeSpan -Start (Get-Date -Date '1970-01-01') -End (($timestamp).ToUniversalTime())).TotalSeconds * 1E9)
}

function processRows($importFile) {
  $alldata = Get-Content -Path $importFile | Select-Object -Skip 11 | Select-Object -SkipLast 4
  
  $csvHeader = "Inverter","Vpv1","Vpv2","Ipv1","Ipv2","Vac1","Vac2","Vac3","Iac1","Iac2","Iac3","Pac","Fac","Temperature","TimeStamp","Energy_Today","Energy_Total"
  $data = ConvertFrom-Csv -InputObject $($alldata | Select-Object -skip 11 ) -Header $csvHeader
  

  $logrows = @()

  foreach ($row in $data) {
    # "Nov.19 08:23,2018"

    $logtime = [datetime]::ParseExact($row.TimeStamp, "MMM.dd HH:mm,yyyy", [cultureinfo]::InvariantCulture)
    if ($error.Count -gt 0) {
      $row.timestamp
      $error.Clear()
      continue
    }
    
    $timeString = ConvertTo-UnixTimeNanosecond -timestamp $logtime

    $currPwr = [double]$([double]$row.vpv1 * [double]$row.ipv1) + [double]$([double]$row.vpv2 * [double]$row.ipv2)

    $logString = "pv_data,serial=" + $row.Inverter.Replace("'", "") + " temp=" + $([double]$row.temperature).ToString("N2") +
                 ",vpv1=" + $([double]$row.vpv1).ToString("N2") + ",vpv2=" + $([double]$row.vpv2).ToString("N2") +
                 ",ipv1=" + $([double]$row.ipv1).ToString("N2") + ",ipv2=" + $([double]$row.ipv2).ToString("N2") +
                 ",iac1=" + $([double]$row.iacv1).ToString("N2") + ",iac2=" + $([double]$row.iac2).ToString("N2") + ",iac3=" + $([double]$row.iac3).ToString("N2") +
                 ",vac1=" + $([double]$row.vac1).ToString("N2") + ",vac2=" + $([double]$row.vac2).ToString("N2") + ",vac3=" + $([double]$row.vac3).ToString("N2") +
                 ",fac=" + $([double]$row.fac).ToString("N2") + ",pac=" + $([double]$row.pac).ToString("N2") +
                 ",e_today=" + $([double]$row.Energy_Today).ToString("N2") + ",e_total=" + $([double]$row.Energy_Total).ToString("N2") +
                 ",ppv=" + $([double]$currPwr).ToString("N2")


  #  let influxData='pv_data,serial=' + lineData.payload.serial + ' temp=' + lineData.payload.temp.toFixed(1) 
  #                     + ',vpv1=' + lineData.payload.v_pv[0].toFixed(1) + ',vpv2=' +lineData.payload.v_pv[1].toFixed(1)
  #                     + ',ipv1=' + lineData.payload.i_pv[0].toFixed(1) + ',ipv2=' +lineData.payload.i_pv[1].toFixed(1)
  #                     + ',iac1=' + lineData.payload.i_ac[0].toFixed(1) + ',iac2=' +lineData.payload.i_ac[1].toFixed(1)
  #                     + ',vac1=' + lineData.payload.v_ac[0].toFixed(1) + ',vac2=' +lineData.payload.v_ac[1].toFixed(1)
  #                     + ',fac=' + lineData.payload.f_ac.toFixed(2) + ',pac=' +lineData.payload.p_ac.toFixed(1)
  #                     + ',e_today=' + lineData.payload.E_tod.toFixed(1) + ',e_total=' + lineData.payload.E_tot; 
    

    $logString += " " + $timeString
 
    $tmpData = New-Object -TypeName PSCustomObject
    $tmpData | Add-Member -NotePropertyName "timestamp" -NotePropertyValue $logtime.toString("yyyy-MM-dd HH:mm:ss")
    $tmpData | Add-Member -NotePropertyName "logstring" -NotePropertyValue $logString

    $logrows += $tmpData
  
  }
  
  submitRows -data $logrows

  return $logrows
}

function submitRows($data) {
  $uri = "http://" + $dbIp + ":8086/write?db=" + $dbName

  $pair="${dbUser}:${dbPass}"

  $bytes=[System.Text.Encoding]::ASCII.GetBytes($pair)
  $base64=[System.Convert]::ToBase64String($bytes)

  $basicAuthValue = "Basic $base64"

  $headers = @{ Authorization = $basicAuthValue }
  $error.Clear()
  $count = 0
  $insertCmd = ""
  foreach ($row in $data) {
    
    #$result = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $row.logstring -TimeoutSec 30
    if ($error.Count -gt 0) {
      Write-Host "hela..." -ForegroundColor Red
      $error.Clear()
    }

    $insertCmd += $row.logstring + "`n"
    if ($count++ -eq 25) {
      $result = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $insertCmd -TimeoutSec 30
      Write-Host "." -NoNewline -ForegroundColor Green
      $count = 0
    }
  }
  $result = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $insertCmd -TimeoutSec 30
  Write-Host ". - upload done"
}

$logdata = @()

#$folder = "C:\Users\XXX\Domotica_OH2\automation\powershell\data_ginlong"

(Get-Culture).NumberFormat.NumberDecimalSeparator = '.'
(Get-Culture).NumberFormat.NumberGroupSeparator = ''

Get-ChildItem $folder -Filter *.csv |
ForEach-Object {
  Write-host $_.BaseName" - " -NoNewline
  $logdata += processRows -importFile $_.FullName
}


# extra debugging and diagnostics
#$logdata | Sort-Object $_.timestamp -Descending | Export-Csv -Path "C:\Users\XXX\Domotica_OH2\automation\powershell\influxdata_ginlong.csv" -Delimiter ";"
#$logdata | Set-Content -Path "C:\Users\XXX\Domotica_OH2\automation\powershell\influxdata_ginlong.txt"
