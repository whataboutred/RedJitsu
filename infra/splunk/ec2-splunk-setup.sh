#!/bin/bash
# EC2 Splunk Installation Script
# Run this on a fresh Ubuntu 22.04 EC2 instance

set -e

echo "=== Starting Splunk Installation on EC2 ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y wget curl

# Download Splunk Enterprise (Free license - 500MB/day)
cd /opt
sudo wget -O splunk-9.1.2-b6b9c8185839-linux-2.6-amd64.deb \
  'https://download.splunk.com/products/splunk/releases/9.1.2/linux/splunk-9.1.2-b6b9c8185839-linux-2.6-amd64.deb'

# Install Splunk
sudo dpkg -i splunk-9.1.2-b6b9c8185839-linux-2.6-amd64.deb

# Create splunk user and set permissions
sudo useradd -r -m -s /bin/bash splunk
sudo chown -R splunk:splunk /opt/splunk

# Start Splunk and accept license
sudo -u splunk /opt/splunk/bin/splunk start --accept-license --answer-yes --no-prompt --seed-passwd changeme123

# Enable Splunk to start at boot
sudo /opt/splunk/bin/splunk enable boot-start -user splunk --accept-license --answer-yes --no-prompt

# Configure HTTP Event Collector
sudo -u splunk /opt/splunk/bin/splunk http-event-collector enable -name ironlog-hec -uri https://localhost:8089 -auth admin:changeme123

# Create HEC token
TOKEN=$(sudo -u splunk /opt/splunk/bin/splunk http-event-collector create ironlog-token -uri https://localhost:8089 -auth admin:changeme123 | grep token | awk '{print $4}')

echo "=== Installation Complete! ==="
echo "Splunk Web UI: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
echo "Username: admin"
echo "Password: changeme123"
echo "HEC Token: $TOKEN"
echo "HEC URL: https://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8088"

# Configure firewall (if ufw is active)
sudo ufw allow 8000/tcp  # Splunk Web
sudo ufw allow 8088/tcp  # HEC
sudo ufw allow 8089/tcp  # Splunk Management
sudo ufw allow 9997/tcp  # Splunk Forwarder

echo "=== Security Groups Required ==="
echo "Allow inbound traffic on:"
echo "- Port 8000 (Splunk Web) from YOUR IP"
echo "- Port 8088 (HEC) from YOUR IP" 
echo "- Port 22 (SSH) from YOUR IP"