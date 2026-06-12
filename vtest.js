require('reflect-metadata');
const { ValidationPipe } = require('@nestjs/common');
const cv = require('class-validator');
const ct = require('class-transformer');

class McAmount {}
cv.IsOptional()(McAmount.prototype, 'amount');
cv.IsString()(McAmount.prototype, 'amount');
cv.IsOptional()(McAmount.prototype, 'currency');
cv.IsString()(McAmount.prototype, 'currency');

class PaymentInner {}
cv.IsOptional()(PaymentInner.prototype, 'payment_amount');
cv.ValidateNested()(PaymentInner.prototype, 'payment_amount');
ct.Type(() => McAmount)(PaymentInner.prototype, 'payment_amount');

class PaymentReq {}
cv.IsOptional()(PaymentReq.prototype, 'paymentrequest');
cv.ValidateNested()(PaymentReq.prototype, 'paymentrequest');
ct.Type(() => PaymentInner)(PaymentReq.prototype, 'paymentrequest');

const pipe = new ValidationPipe({ whitelist:false, forbidNonWhitelisted:false, transform:false, skipMissingProperties:true });
const meta = { type:'body', metatype: PaymentReq, data:'' };

async function run(label, body){
  try {
    const out = await pipe.transform(body, meta);
    console.log(label, '=> PASSED', JSON.stringify(out), '| instanceof PaymentReq:', out instanceof PaymentReq);
  } catch(e){
    console.log(label, '=> REJECTED', (e.response && JSON.stringify(e.response.message)) || e.message);
  }
}
(async()=>{
  await run('number-amount', { paymentrequest: { payment_amount: { amount: 105.15, currency:'USD' } } });
  await run('string-amount', { paymentrequest: { payment_amount: { amount: '105.15', currency:'USD' } } });
  await run('missing-amount', { paymentrequest: { payment_type:'P2B' } });
  await run('amount-not-object', { paymentrequest: { payment_amount: 'oops' } });
  await run('inner-not-object', { paymentrequest: 'oops' });
  await run('extra-fields', { paymentrequest: { foo:'bar', payment_amount:{amount:'1'} }, topextra: 'x' });
  await run('array-nested', { paymentrequest: { payment_amount: [{amount: 105.15}] } });
})();
