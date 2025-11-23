FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies for pandas and lxml
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project (including services/ folder)
COPY . .

# Run the FastAPI application
# Using python main.py to respect PORT environment variable
CMD ["python", "main.py"]

