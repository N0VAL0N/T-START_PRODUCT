# certs/

Публичные CA-сертификаты, которым доверяем для запросов к T-Invest.

T-Банк использует сертификаты НУЦ Минцифры (Russian Trusted Root CA + Russian
Trusted Sub CA). Их нет в стандартном хранилище Node — без них TLS падает с
SELF_SIGNED_CERT_IN_CHAIN. Сервер при старте читает ВСЕ *.pem/*.cer/*.crt из этой
папки и добавляет их к системным доверенным (проверка TLS остаётся включённой).

## Файлы
- russian_trusted_root_ca.pem  — https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt
- russian_trusted_sub_ca.pem   — https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt

Это ПУБЛИЧНЫЕ сертификаты (не секрет) — коммитятся в репозиторий.

## Локально с антивирусом (Kaspersky и т.п.)
Если TLS ломает антивирус (он подменяет сертификат своим) — либо отключите
HTTPS-сканирование, либо положите его корневой сертификат сюда, либо задайте
TSTART_INSECURE_TLS=1 (только локально!). На чистом сервере (Amvera) этого не нужно.
