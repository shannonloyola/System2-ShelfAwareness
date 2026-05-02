FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 5173
CMD ["npm", "run", "start", "--", "--port", "5173", "-H", "0.0.0.0"]
