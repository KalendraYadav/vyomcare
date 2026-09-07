terminal1:
cd "/mnt/d/web project/vyomcare"

docker compose -f docker-compose.prod.yml --env-file .env.hackathon up -d

docker compose -f docker-compose.prod.yml ps



terminal 2:

cloudflared tunnel --url http://localhost:80