# Use a Python + Node base image (fits node backend and python AI engine)
FROM nikolaik/python-nodejs:python3.10-nodejs18

WORKDIR /app

# Copy package files and install backend dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Install Python requirements globally in the image
# This avoids needing a separate .venv folder inside the docker image
RUN pip install --no-cache-dir numpy pandas scikit-learn tensorflow shap

# Copy the rest of the codebase into the working directory
COPY public/ ./public/
COPY server/ ./server/
COPY ai_engine/ ./ai_engine/

# Ensure SQLite can write to db directory if mounted
RUN mkdir -p /app/data

# Set port environment
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start Express Server
CMD ["node", "server/server.js"]
