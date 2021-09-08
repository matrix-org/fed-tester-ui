FROM node:16

COPY . /src
WORKDIR /src

RUN npm install --global gulp-cli
RUN npm install
RUN gulp build

FROM nginx:1-alpine
COPY --from=0 /src/build /usr/share/nginx/html
