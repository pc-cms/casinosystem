FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      postgresql-client zstd tar curl tzdata cron ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh \
 && echo "30 1 * * * root /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/cron.d/cms-backup \
 && chmod 0644 /etc/cron.d/cms-backup
# cron: 04:30 EAT (= 01:30 UTC) ежедневно, до бизнес-роллoвера 05:00
CMD ["bash","-c","touch /var/log/backup.log && cron -f & tail -F /var/log/backup.log"]
