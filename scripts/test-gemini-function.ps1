# Test Gemini Edge Function
# Usage: .\scripts\test-gemini-function.ps1

Write-Host "🧪 Testing Gemini Edge Function..." -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$supabaseUrl = $env:VITE_SUPABASE_URL
$anonKey = $env:VITE_SUPABASE_ANON_KEY

if (-not $supabaseUrl -or -not $anonKey) {
    Write-Host "❌ Error: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env" -ForegroundColor Red
    exit 1
}

Write-Host "📍 Supabase URL: $supabaseUrl" -ForegroundColor Gray
Write-Host "🔑 Using Anon Key: $($anonKey.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        'Authorization' = "Bearer $anonKey"
        'Content-Type' = 'application/json'
        'apikey' = $anonKey
    }
    
    $body = @{
        prompt = "Halo! Tolong jawab dengan singkat: Apa itu Vena Pictures?"
    } | ConvertTo-Json
    
    Write-Host "📤 Sending request..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod `
        -Uri "$supabaseUrl/functions/v1/gemini-chat" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 30
    
    Write-Host ""
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 AI Response:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host $response.text -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ Edge Function berfungsi dengan baik!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorBody = $reader.ReadToEnd()
            
            Write-Host ""
            Write-Host "Error Details:" -ForegroundColor Yellow
            Write-Host $errorBody -ForegroundColor Red
        } catch {
            Write-Host "Could not read error details" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Cyan
    Write-Host "  1. Pastikan Edge Function sudah di-deploy: npx supabase functions deploy gemini-chat" -ForegroundColor Gray
    Write-Host "  2. Cek GEMINI_API_KEY di Supabase Dashboard → Edge Functions → Secrets" -ForegroundColor Gray
    Write-Host "  3. Verifikasi API key valid di Google AI Studio" -ForegroundColor Gray
    Write-Host "  4. Cek logs di Supabase Dashboard → Edge Functions → gemini-chat → Logs" -ForegroundColor Gray
    
    exit 1
}
