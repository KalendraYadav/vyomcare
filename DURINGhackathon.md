terminal1:
cd "/mnt/d/web project/vyomcare"

docker compose -f docker-compose.prod.yml --env-file .env.hackathon up -d

docker compose -f docker-compose.prod.yml ps


backend
npm run start:dev

forntend
npm run dev



terminal 2:

cloudflared tunnel --url http://localhost:80

chat gpt:--   master implementation prompt

#open this link to test locally

http://localhost

not
http://localhost:3000