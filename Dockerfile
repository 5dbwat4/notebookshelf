# Part 1: Compile the frontend

FROM node:25-alpine AS build

WORKDIR /app

# Copy the frontend source code
COPY ./frontend/ .
RUN npm install
RUN npm run build


# Part 2: Run the backend
FROM node:25-alpine
WORKDIR /app

COPY --from=build /app/dist public

COPY ./bookshelf .
RUN npm install
ENTRYPOINT [ "npm", "run", "server" ]