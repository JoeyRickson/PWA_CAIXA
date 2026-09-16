$ErrorActionPreference = "Stop"

$project = (Get-Location).Path
$source = Join-Path $env:USERPROFILE "Downloads\icone.png"
$icons  = Join-Path $project "icons"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Não encontrei o ícone em: $source"
}

New-Item -ItemType Directory -Path $icons -Force | Out-Null
Add-Type -AssemblyName System.Drawing

function Resize-Png {
    param(
        [Parameter(Mandatory=$true)][string]$SourcePath,
        [Parameter(Mandatory=$true)][string]$OutputPath,
        [Parameter(Mandatory=$true)][int]$Size
    )

    $img = [System.Drawing.Image]::FromFile($SourcePath)
    try {
        $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.DrawImage($img, 0, 0, $Size, $Size)
            }
            finally {
                $g.Dispose()
            }

            $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $bmp.Dispose()
        }
    }
    finally {
        $img.Dispose()
    }
}

Resize-Png -SourcePath $source -OutputPath (Join-Path $icons "icon-192.png") -Size 192
Resize-Png -SourcePath $source -OutputPath (Join-Path $icons "icon-512.png") -Size 512
Resize-Png -SourcePath $source -OutputPath (Join-Path $icons "maskable-192.png") -Size 192
Resize-Png -SourcePath $source -OutputPath (Join-Path $icons "maskable-512.png") -Size 512
Resize-Png -SourcePath $source -OutputPath (Join-Path $icons "apple-touch-icon.png") -Size 180

Write-Host ""
Write-Host "Ícones do SaldoPlan criados com sucesso:" -ForegroundColor Green
Get-ChildItem -LiteralPath $icons | Select-Object Name, Length, LastWriteTime
