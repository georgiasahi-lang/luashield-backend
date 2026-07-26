FROM node:20-slim

RUN apt-get update && apt-get install -y \
    lua5.4 \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN git clone https://github.com/prometheus-lua/Prometheus prometheus

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
