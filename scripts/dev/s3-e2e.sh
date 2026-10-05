#!/usr/bin/env bash
# Runs test/s3-e2e.test.ts against moto, an independent S3 implementation that checks SigV4 signatures
# (moto enforces auth after INITIAL_NO_AUTH_ACTION_COUNT requests; the script burns them first).
# Needs python3 with venv and network for `pip install moto[server]` the first time. Presigned GET URLs are not served by moto
# (its own boto3 URLs fail too), so those are compared with boto3's output instead.
set -euo pipefail
cd "$(dirname "$0")/../.."
VENV=${MOTO_VENV:-/tmp/motoenv}; PORT=${MOTO_PORT:-5555}
[ -x "$VENV/bin/moto_server" ] || { python3 -m venv "$VENV"; "$VENV/bin/pip" install -q 'moto[server]'; }
INITIAL_NO_AUTH_ACTION_COUNT=100 "$VENV/bin/moto_server" -p "$PORT" >/tmp/moto.log 2>&1 & MOTO=$!
trap 'kill $MOTO 2>/dev/null' EXIT
sleep 3
eval "$("$VENV/bin/python" - <<PY
import boto3
ep='http://127.0.0.1:$PORT'
iam=boto3.client('iam',endpoint_url=ep,region_name='us-east-1',aws_access_key_id='x',aws_secret_access_key='y')
iam.create_user(UserName='pub')
iam.put_user_policy(UserName='pub',PolicyName='p',PolicyDocument='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:*","Resource":"*"}]}')
k=iam.create_access_key(UserName='pub')['AccessKey']
s3=boto3.client('s3',endpoint_url=ep,region_name='eu-west-1',aws_access_key_id=k['AccessKeyId'],aws_secret_access_key=k['SecretAccessKey'])
s3.create_bucket(Bucket='bkt',CreateBucketConfiguration={'LocationConstraint':'eu-west-1'})
for _ in range(110): s3.list_buckets()
from botocore.config import Config
p=boto3.client('s3',endpoint_url=ep,region_name='eu-west-1',aws_access_key_id=k['AccessKeyId'],aws_secret_access_key=k['SecretAccessKey'],config=Config(s3={'addressing_style':'path'},signature_version='s3v4'))
print("export S3_E2E_ENDPOINT=%s S3_E2E_KEY=%s S3_E2E_SECRET=%s"%(ep,k['AccessKeyId'],k['SecretAccessKey']))
print("export S3_E2E_BOTO_URL='%s'"%p.generate_presigned_url('get_object',Params={'Bucket':'bkt','Key':'pre/commercial/a b.json'},ExpiresIn=60))
PY
)"
npx vitest run test/s3-e2e.test.ts
