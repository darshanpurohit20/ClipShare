# Use the official Python image as a base
FROM python:3.9-slim

# Set environment variables for non-interactive shell and to prevent Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (important for Pillow and other Python libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a directory for uploads and set its permissions
# This ensures that Hugging Face Spaces won't have permission issues
RUN mkdir -p uploads && chmod 777 uploads

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Hugging Face Spaces expects the application to listen on port 7860
ENV PORT=7860
EXPOSE 7860

# Command to run the application using Gunicorn (recommended for production)
# Alternatively, if you prefer using Flask's built-in server as configured in app.py:
# CMD ["python", "app.py"]
# But for Hugging Face Spaces, it's safer to ensure it hits the PORT env var correctly.
CMD ["python", "app.py"]