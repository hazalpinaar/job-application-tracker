# Rota — İş Başvurusu Takip Uygulaması

Next.js App Router, React, TypeScript, Tailwind CSS, Prisma ve SQLite ile Türkçe başvuru takip uygulaması. Bilgisayar ve telefon tarayıcılarında çalışır.

## Özellikler

- Modern giriş ve kayıt ekranları; e-posta / şifre ile hesap oluşturma
- Kullanıcıya özel başvurular, sunucuda yetki kontrolü
- Scrypt ile tuzlanmış şifre özetleri; HttpOnly, SameSite çerezli 7 günlük oturum
- Çıkışta sunucu tarafında oturum iptali; hesap başına deneme sınırı
- Ekleme, düzenleme, not tutma, onaylı silme, arama ve durum filtreleri
- Başvuru / görüşme / teklif özeti, JSON dışa aktarma
- Masaüstünde tablo, mobilde başvuru kartları ve dokunmaya uygun kontroller

## Kurulum

Node.js 22+ ve npm gerekir.

```bash
npm ci
```

`.env.example` dosyasını `.env` olarak kopyalayın (`Copy-Item .env.example .env`).

```bash
npm run db:push
npm run dev
```

http://127.0.0.1:3000 adresinde Hesap oluştur sekmesini kullanın. İlk oluşturulan hesap, önceki tek kullanıcılı sürümden kalan sahipsiz başvuruları devralır. Sonraki hesaplar boş başlar. İlk hesabı uygulamayı başkalarıyla paylaşmadan önce oluşturun.

```bash
npm run build
npm start
```

Windows'ta derleme sonrasında `Rota-Baslat.cmd` dosyasını çift tıklayabilirsiniz. Pencereyi kullanım boyunca açık tutun.

## Mobil kullanım

Arayüz telefon tarayıcıları için uyumludur; bu sürüm yerel Android / iOS uygulaması değildir. Telefonunuzdan erişmek için uygulamanın erişilebilir bir sunucuda çalışması gerekir. Aynı güvenilir Wi-Fi ağında denemek için:

```bash
npm run dev:network
```

Bilgisayarın yerel IP adresini kullanın: `http://BILGISAYAR_IP_ADRESI:3000`. Telefondaki `localhost` veya `127.0.0.1`, bilgisayarınızı değil telefonu ifade eder. İşletim sisteminin ağ erişim ayarları bağlantıya izin vermelidir.

## Dağıtım

SQLite için kalıcı, yazılabilir disk gerekir. `.env` içinde `APP_ORIGIN=https://alan-adiniz.com` tanımlayın; bu ayar kaynak kontrolünü sabitler ve oturum çerezlerini Secure yapar. HTTPS kullanın. Yerel HTTP için bu değişken boş bırakılabilir. Çok sunuculu dağıtım öncesinde kalıcı ortak veritabanına geçin.

E-posta doğrulaması, şifre sıfırlama ve sosyal giriş bu sürüme dahil değildir. E-posta şu anda hesap tanımlayıcısı olarak kullanılır; e-posta sahipliği doğrulanmaz.

## Kontroller

```bash
npm run typecheck
npm run build
npm run test:auth
```

Auth testi ayrı bir geçici veritabanı ve 3101 portu kullanır; gerçek başvurulara dokunmaz. Kayıt, giriş, kullanıcı ayrımı, oturum iptali ve kaynak kontrolünü test eder.

## Proje yapısı

- `app/page.tsx`: Oturum denetimli ana sayfa
- `app/login/page.tsx`, `components/login-form.tsx`: Giriş / kayıt ekranı
- `components/dashboard.tsx`: Başvuru paneli
- `app/api/auth/[action]/route.ts`: Kayıt, giriş, çıkış
- `app/api/applications/route.ts`: Kullanıcıya özel CRUD
- `lib/auth.ts`: Şifre, çerez ve oturum yardımcıları
- `prisma/schema.prisma`: Veri modelleri

`.env`, veritabanları ve derleme çıktıları Git'e dahil edilmez. Uygulama kapalıyken `prisma/dev.db` dosyasını yedekleyebilirsiniz; bu dosya hesap ve başvuru verileri içerir. Kişisel JSON dışa aktarımlarını repoya eklemeyin.

## GitHub

GitHub'da boş bir repo oluşturduktan sonra bu klasörde:

```bash
git init
git add .
git commit -m "Build Rota application tracker with authentication"
git branch -M main
git remote add origin https://github.com/KULLANICI/job-application-tracker.git
git push -u origin main
```

Teknik kaynaklar: [Next.js kimlik doğrulama](https://nextjs.org/docs/app/guides/authentication), [Node.js Crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html).
