# Single image: Next.js app + Python (pdf2docx / PyMuPDF) + LibreOffice for conversions.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PYTHON_PATH=/opt/venv/bin/python \
    SOFFICE_PATH=/usr/bin/soffice

# LibreOffice Writer + common fonts (metric-compatible Arial/Times/Courier, plus broad Unicode coverage)
# so Word documents render with the right layout.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui fonts-liberation fonts-dejavu-core fonts-noto-core fonts-crosextra-carlito fonts-crosextra-caladea \
      python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY scripts ./scripts
COPY next.config.ts ./

USER node
EXPOSE 3000
CMD ["npm", "start"]
