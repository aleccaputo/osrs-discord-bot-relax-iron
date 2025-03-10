FROM debian:bullseye as builder

ARG NODE_VERSION=18.14.2

ENV PATH=/usr/local/node/bin:$PATH
RUN apt-get update; apt install -y curl python-is-python3 pkg-config build-essential && \
    curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \
    /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \
    rm -rf /tmp/node-build-master

#######################################################################

RUN mkdir /app
WORKDIR /app

# npm will not install any package listed in "devDependencies" when NODE_ENV is set to "production"
# to install all modules: "npm install --production=false"

ENV NODE_ENV production

COPY . .

RUN npm install --production=false && npm run build
FROM debian:bullseye

LABEL fly_launch_runtime="nodejs"

COPY --from=builder /usr/local/node /usr/local/node
COPY --from=builder /app /app

WORKDIR /app
ENV NODE_ENV production
ENV PATH /usr/local/node/bin:$PATH

CMD npm run deploySlashCommands && npm run start
