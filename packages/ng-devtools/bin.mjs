#!/usr/bin/env node
import { createNgDevtoolsCli } from '@pangular-inspector/devtools/cli';

await createNgDevtoolsCli().parse();
