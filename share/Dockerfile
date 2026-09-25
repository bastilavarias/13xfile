FROM nginx:1.27-alpine
COPY docker/nginx-static.conf /etc/nginx/conf.d/default.conf
COPY share/ /usr/share/nginx/html/
EXPOSE 80
