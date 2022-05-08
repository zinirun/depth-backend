FROM public.ecr.aws/docker/library/node:16-slim

RUN apt-get update
RUN apt install yarn -y

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . .
RUN yarn install
RUN yarn build

EXPOSE 7000

CMD ["yarn", "start:prod"]
