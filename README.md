# Discord Points Bot

A Discord bot for tracking and managing user points with MongoDB integration.

## Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your system
- [Node.js](https://nodejs.org/) (version 18.14.2 or higher recommended)

## Getting Started

Follow these simple steps to set up and run the bot:

1. **Clone the repository**


2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory with your configuration:

   ```
   DATA_CONNECTION=mongodb://admin:password@localhost:27017/your_database_name?authSource=admin
   # Add other required environment variables, contact dev for help
   ```

4. **Start MongoDB with Docker**

   ```bash
   docker-compose up -d
   ```

   This will start a MongoDB instance and Mongo Express (available at http://localhost:8081).

5. **Start the bot**

   ```bash
   npm start
   ```

## Development

### Slash Commands

To register or update Discord slash commands:

```bash
npm run deploySlashCommands
```

### Database Management

You can access the MongoDB web interface at http://localhost:8081.

## Deployment

For production deployment, the project includes a Dockerfile that can be used with platforms like Fly.io.

## Troubleshooting

If you encounter database connection issues:

1. Check that the Docker containers are running:
   ```bash
   docker ps
   ```

2. Verify your MongoDB connection string in the `.env` file

3. If needed, restart the containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## License

[Your License]
