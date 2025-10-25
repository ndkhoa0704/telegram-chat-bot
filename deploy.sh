#!/bin/bash

docker compose -f docker-compose-prod.yml build server
docker compose -f docker-compose-prod.yml up -d