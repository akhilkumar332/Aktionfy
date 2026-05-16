#!/bin/sh
docker-compose exec -T db psql -U postgres -d mcp -c "UPDATE schema_migrations SET dirty = false WHERE version = 2;"
