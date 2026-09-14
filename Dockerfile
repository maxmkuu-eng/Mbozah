FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

# Faable supplies PORT at runtime. Patch the existing server to honor it,
# while keeping 10000 as a local fallback.
RUN sed -i "s/const PORT = 10000;/const PORT = Number(process.env.PORT) || 10000;/" server.ts
RUN node patch-faable-server.mjs

RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /app/data/files

# Keep 10000 as the documented/default container port; Faable may override
# the runtime PORT environment variable.
EXPOSE 10000

CMD ["node", "dist/server.cjs"]
