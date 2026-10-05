# OpenCode ve 9router bağlantıları

Windows uygulamasında **Settings → Chat connection** bölümünden sohbet
sağlayıcısını seçebilirsiniz. Claude varsayılan olarak korunur. Sağlayıcı,
sunucu veya model değişince sonraki sohbet yeni bir konuşma başlatır.

## OpenCode

1. OpenCode'u kurup istediğiniz sağlayıcıyı yapılandırın.
2. PowerShell'de sunucuyu başlatın:

   ```powershell
   opencode serve --hostname 127.0.0.1 --port 4096
   ```

3. Ayarlarda **OpenCode** seçin. Sunucu adresi `http://127.0.0.1:4096`.
4. Sunucu Basic Auth kullanıyorsa kullanıcı adını ve sunucu parolasını girin.
   Varsayılan kullanıcı adı `opencode`; parola isteğe bağlıdır.
5. Parolayı **Save key & load models** ile kaydedince modeller otomatik yüklenir.
   Kayıtlı parola varsa sağlayıcı açıldığında da liste yüklenir. Parolasız yerel
   sunucuda **Reload models** kullanın. Model listesinden seçim yapın veya
   **Server default** seçeneğini bırakın.
6. **Save connection** ile kaydedin; adadaki sohbeti açıp mesaj gönderin.

Mannis kendi sohbet oturumunu oluşturur. Bu oturumda araç izinleri kapalıdır:
sohbet mesajı dosya okuma, düzenleme veya komut çalıştırma yetkisi vermez.
Sunucu bu izinleri doğrulamıyorsa Mannis mesaj göndermeyi reddeder.
OpenCode CLI oturumlarının adada izlenmesi ve izin kartları bu aşamanın kapsamında
uygulanmadı; mevcut Claude Code hook bağlantısı ayrı olarak çalışır.

## 9router

1. Kendi 9router sunucunuzu başlatın.
2. **9router** seçin. Yerel varsayılan API adresi `http://127.0.0.1:20128/v1`.
3. Dashboard'dan aldığınız API anahtarını girin; kimlik doğrulama istemeyen yerel
   bir sunucuda alanı boş bırakabilirsiniz.
4. **Save key & load models** ile anahtarı kaydedin; model listesi otomatik gelir.
   Model açılır listesinden seçim yapın. Kayıtlı anahtar varsa sağlayıcı açıldığında
   modeller yüklenir. **Reload models** listeyi yeniler. Listede olmayan model veya
   combo için **Custom model / combo…** seçeneğini kullanın.
5. **Save connection** ile kaydedin ve sohbeti kullanın.

Bu çalışma sırasında yerel sunucuda `oc/space-bunny-free` doğrudan test edildi.
Model listesi aynı modeli `ocg/space-bunny-free` olarak duyuruyordu; sunucu `oc/`
alias'ını da kabul etti. Model kimlikleri ve ücretsiz kullanım kotaları servis
ayarlarına göre değişir; uygulama sabit bir ücretsiz model listesi taşımaz.

## Dosyalar ve anahtarlar

OpenCode ve 9router sohbetleri UTF-8 metin/kod dosyalarını en fazla 200.000 bayt
olarak destekler. Görsel, PDF ve diğer ikili dosyalar için açık hata gösterilir.
Claude'un mevcut dosya desteği korunur.

Anahtarlar ve sunucu parolaları Windows Credential Manager'da saklanır; JSON
ayar dosyasına veya webview'e geri gönderilmez. Boş parola alanı mevcut anahtarı
korur; **Remove credential** onu kaldırır. HTTP sadece loopback adreslerinde
kabul edilir; uzak sunucular HTTPS kullanmalıdır. Yönlendirmeler izlenmez.

## Geliştirme ve kontroller

Windows 10/11, Node 20+, Rust MSVC araç zinciri, Visual Studio C++ Build Tools
ve WebView2 gerekir. Frontend testleri için Bun kullanılır.

```powershell
cd windows
npm ci
npm run check
bun test tests
cargo build --locked --release -p mannis-hook
cargo test --locked --workspace
npm run build
npm run tauri dev
```

`npm run dev` tarayıcıda arayüzü açar; gerçek sohbet, anahtar ve ayar kaydı Tauri
uygulamasını gerektirir. `/dev/providers-preview.html` gerçek DOM üzerinde
başarı/hata/bekleme/kayıt senaryolarını yerel test verileriyle gösterir. Bu sayfa
üretim paketine girmez ve gerçek sunucuya bağlanmaz.

Opt-in canlı adapter testi varsayılan testlerde çalışmaz. Açıkça verilen
`MANNIS_TEST_URL`, `MANNIS_TEST_MODEL`, `MANNIS_TEST_API_KEY` ortam değişkenleriyle:

```powershell
cargo test -p mannis --lib chat::tests::live_router_adapter_smoke -- --ignored --exact
```

Kaynak sözleşmeleri: [OpenCode Server](https://opencode.ai/docs/server/) ve
[9router entegrasyon kılavuzu](https://github.com/decolua/9router/blob/master/gitbook/content/en/integration/other-tools.md).
