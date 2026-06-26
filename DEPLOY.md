# LeadFrog — VPS Deployment Guide
## Domain: lead.digitalfoxz.com | VPS: 162.35.161.175

---

## 1. Push code to VPS

```bash
# On your PC — push to GitHub first (or use scp)
scp -r C:\Users\HP\leadfrog root@162.35.161.175:/var/www/leadfrog
```

Or use Git:
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/digitalfoxzai-byte/leadfrog.git
git push -u origin main
```

On VPS:
```bash
ssh root@162.35.161.175
cd /var/www && git clone https://github.com/digitalfoxzai-byte/leadfrog.git
```

---

## 2. Setup MySQL Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE leadfrog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'leadfrog'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON leadfrog_db.* TO 'leadfrog'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
mysql -u leadfrog -p leadfrog_db < /var/www/leadfrog/lib/schema.sql
```

---

## 3. Environment Variables

```bash
cp /var/www/leadfrog/.env.example /var/www/leadfrog/.env
nano /var/www/leadfrog/.env
```

Fill in:
- `DB_PASSWORD` — your MySQL password
- `NEXTAUTH_SECRET` — run `openssl rand -base64 32`
- `NEXTAUTH_URL=https://lead.digitalfoxz.com`
- Razorpay keys (or set later in Admin Dashboard)

---

## 4. Install & Build

```bash
cd /var/www/leadfrog
npm install
npm run build
```

---

## 5. PM2 Start

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 6. Nginx Config

```bash
cp /var/www/leadfrog/nginx.conf /etc/nginx/sites-available/leadfrog
ln -s /etc/nginx/sites-available/leadfrog /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. SSL Certificate

```bash
certbot --nginx -d lead.digitalfoxz.com
```

---

## 8. Set Admin User

After first signup, promote yourself to admin:
```sql
mysql -u leadfrog -p leadfrog_db -e "UPDATE users SET role='admin' WHERE email='digitalfoxzsolutions@gmail.com';"
```

---

## Deploy Updates

```bash
ssh root@162.35.161.175
cd /var/www/leadfrog
git pull && npm run build && pm2 restart leadfrog
```

---

## Copy logo to project

```bash
# Copy logo.png from LeadHunterPro to leadfrog public folder
cp /var/www/leadhunterpro/logo.png /var/www/leadfrog/public/logo.png
```
