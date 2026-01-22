
# Deployment Guide

## VPS Installation (Ubuntu)
1. Install Docker: `sudo apt update && sudo apt install docker.io docker-compose -y`
2. Create project folder: `mkdir ~/jf-organizer && cd ~/jf-organizer`
3. Upload your project files to this folder.
4. Ensure your rclone mounts are active on the VPS (e.g., `/mnt/cloud/movies`).

## Portainer Deployment
1. Go to **Stacks** -> **Add stack**.
2. Name it `jellyfin-organizer`.
3. Paste the contents of `docker-compose.yml` into the web editor.
4. **Important**: Adjust the `volumes` section for the `app` service to match your actual VPS paths.
5. Click **Deploy the stack**.

## Initial Setup
1. Open `http://your-vps-ip:3000`.
2. Go to **Settings**.
3. For MongoDB URI, use: `mongodb://mongodb:27017/jellyfin-organizer`.

## Safe Updates
To update the app without losing database data:
1. Re-upload updated files to the VPS.
2. In Portainer, go to the stack and click **Editor**.
3. Click **Update the stack** and ensure "Pull latest image" / "Re-build" is triggered if using a registry, or simply restart the container if mounting local source.
