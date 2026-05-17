FROM alpine:3.19
RUN apk add --no-cache postgresql15-client zstd tar bash curl tzdata
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
# cron: 04:30 ежедневно (Africa/Dar_es_Salaam = UTC+3 → 01:30 UTC)
RUN echo "30 1 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
CMD ["sh", "-c", "touch /var/log/backup.log && crond -f -l 8 & tail -F /var/log/backup.log"]
