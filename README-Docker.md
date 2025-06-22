# Docker Setup for HeyBurrito

This project includes Docker configuration to run the NestJS application with MongoDB.

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Set up environment variables**
   
   Create a `.env` file or update the existing one with your Slack signing secret:
   ```
   SLACK_SIGNING_SECRET=your-actual-slack-signing-secret
   MONGODB_URI=mongodb://mongo:27017/heyburrito
   PORT=3000
   ```

3. **Build and run the application**
   ```bash
   docker-compose up --build
   ```

   Or run in detached mode:
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application**
   - Application: http://localhost:3000
   - MongoDB: localhost:27017

## Docker Services

### App Service
- **Image**: Built from local Dockerfile
- **Port**: 3000
- **Environment**: Production mode with MongoDB connection
- **Dependencies**: MongoDB service

### MongoDB Service
- **Image**: mongo:7.0
- **Port**: 27017
- **Database**: heyburrito
- **Data Persistence**: Uses Docker volume `mongo_data`

## Useful Commands

```bash
# Start services
docker-compose up

# Start services in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs

# View logs for specific service
docker-compose logs app
docker-compose logs mongo

# Rebuild and start
docker-compose up --build

# Remove volumes (WARNING: This will delete all data)
docker-compose down -v
```

## Development

For development with hot reload, you can modify the docker-compose.yml to:
1. Mount the source code as a volume
2. Change the command to use `npm run start:dev`
3. Install dev dependencies in the Dockerfile

## Troubleshooting

- **Port conflicts**: If port 3000 or 27017 are already in use, modify the port mappings in docker-compose.yml
- **Permission issues**: Ensure Docker has proper permissions to access the project directory
- **MongoDB connection**: The app waits for MongoDB to be ready via the `depends_on` configuration