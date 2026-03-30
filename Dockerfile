# Use a lightweight Python 3.10 image
FROM python:3.10-slim

# Create a user to avoid permission issues on HF
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /home/user/app

# Copy your whole project into the container
COPY --chown=user . .

# Install your backend dependencies
RUN pip install --no-cache-dir --upgrade -r backend/requirements.txt

# Tell HF we are using port 7860 (this is mandatory)
EXPOSE 7860

# Run the app. Note: we point to 'backend.main:app' because main.py is in the backend folder
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
