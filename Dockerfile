# Part 1: Compile the frontend

FROM node:25-alpine AS build

WORKDIR /app

# Copy the frontend source code
COPY ./frontend/ .
RUN npm install
RUN npm run build


# Part 2: Run the backend
FROM node:25-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache python3 make g++ \
    && ln -sf python3 /usr/bin/python

ENV npm_config_python=/usr/bin/python \
    NODE_GYP_FORCE_PYTHON=/usr/bin/python 
    # to make node-gyp happy.


COPY --from=build /app/dist public

COPY ./bookshelf .

RUN npm install
ENTRYPOINT [ "npm", "run", "server" ]