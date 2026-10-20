# FGTS por empresa — SaldoPlan 5.2.1

## Como usar

1. Na aba **FGTS**, selecione uma **empresa** no início da tela. O aplicativo mostra o saldo do último extrato daquela conta e as movimentações posteriores confirmadas.
2. Confira **Último saldo do extrato**, **Depósitos confirmados depois do extrato**, **Outros créditos menos saques** e **Saldo atualizado desta empresa**.
3. Escolha um ano e registre os depósitos do empregador selecionado. A conta ativa fica separada do histórico antigo, que não entra no consolidado.
4. **Saldo atual** não inclui valores previstos nem depósitos datados no futuro. **Previsão até dezembro** é apenas uma projeção.
5. Não há consulta automática ao aplicativo Caixa/FGTS; para atualizar a base, importe um novo extrato e confira os dados antes de aplicar.

## Cuidados

- Um depósito já contido no último saldo do extrato não deve ser somado novamente.
- Após importar novo extrato, sua data e saldo passam a ser a nova base; movimentos anteriores deixam de somar ao total.
- Se marcar um depósito como confirmado com data futura, ele ainda não entra no saldo atual. Use a data do crédito efetivo.
- Exporte backup JSON antes de atualizar e confira a versão do aplicativo antes de publicar.
- A atualização não migra nem altera o conteúdo dos saldos persistidos.
