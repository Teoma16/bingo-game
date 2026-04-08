#!/bin/bash
cd backend
npm install
npm run migrate || true
npm run seed-cartelas || true
node src/server.js