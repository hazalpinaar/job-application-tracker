# Canlı yayın rehberi

Bu repo varsayılan olarak tek bir Node.js sunucusu ve SQLite kullanır. Canlı demo, kodun GitHub'a yüklenmesinden ayrı bir adımdır. Barındırma / e-posta hesabı ve alan adı bu repoyla birlikte sağlanmaz.

## Kalıcı diskli Node.js sunucusu

1. Node.js 22 kurulu bir sunucu / container kullan.
2. `npm ci` ile bağımlılıkları yükle.
3. `DATABASE_URL=file:/data/rota.db` gibi **kalıcı diske** işaret eden bir bağlantı tanımla. Windows'ta `file:C:/data/rota.db` biçimi kullanılabilir.
4. `APP_ORIGIN=https://alan-adin.com` ve README'deki SMTP değişkenlerini tanımla. Canlı kullanımda `REQUIRE_EMAIL_VERIFICATION=true` kullan.
5. İlk kurulumda `npm run db:push`, ardından `npm run build` çalıştır.
6. Bir servis yöneticisiyle `npm start` çalıştır. Varsayılan sunucu yalnızca `127.0.0.1:3000` üzerinde dinler; aynı makinedeki HTTPS reverse proxy bu adrese yönlendirmelidir.
7. Proxy'de istek boyutu, IP bazlı hız sınırı ve HTTPS yapılandır. Sunucu / proxy günlüklerine parola, çerez veya istek gövdesi kaydetme.
8. Kayıt → e-posta doğrulama → giriş → başvuru → çıkış → şifre sıfırlama akışlarını gerçek göndericiyle test et.

SQLite dosyası geçici container dosya sisteminde tutulursa yeniden dağıtımda veriler kaybolabilir. Kalıcı diski sağlayamayan bir platform için önce PostgreSQL'e geçiş gerekir. Bu repo, yalnızca veritabanı URL'sini değiştirerek PostgreSQL'e dönüşmez; Prisma provider'ı, şema geçişleri ve veri aktarımı ayrıca hazırlanmalıdır.

## Yükseltme ve yedekleme

Şema değişikliklerinden önce uygulamayı kapatıp veritabanını ayrı, erişimi kısıtlı bir konuma yedekle. Yedekten geri dönüşü düzenli olarak dene. Bu sürümde şema geliştirme amacıyla `db push` üzerinden yönetilir; sürekli canlı kullanımda sürümlenmiş Prisma migration süreci kur.

SMTP şifresini / veritabanını repoya yükleme. E-posta önizleme için kullanılan `MAIL_TRANSPORT=file` modunu gerçek yayında kullanma. İletilerdeki bağlantılar şifre yenileyebilir; erişimleri özel olmalıdır.

## Yayın sonrası kontrol

- Hesap doğrulaması zorunlu, HTTPS ve Secure çerez etkin.
- İki ayrı kullanıcı birbirinin başvurusuna erişemiyor.
- Şifre yenilenince diğer cihazların oturumu kapanıyor.
- Yeniden başlatma / dağıtım sonrası kayıtlar korunuyor.
- Yedekler ve SMTP gönderim hataları izleniyor.
