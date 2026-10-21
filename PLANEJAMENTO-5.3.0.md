# SaldoPlan v5.3.0 — Planejamento e verificação

## Como usar

1. Abra Planejamento no menu.
2. Informe o saldo disponível **hoje** e sua data. O saldo deve incluir o dinheiro que já entrou e descontar o que já saiu.
3. O painel calcula somente lançamentos `previstos` até 90 dias a partir da data do saldo, sem projetar cobranças ainda não criadas e sem duplicar valores `realizados`.
4. Em cartões, selecione cartão, data, valor e parcelas para simular as datas de fatura e o valor exato. Use **Cartões** para efetivamente cadastrar a compra.
5. Para conferir extratos, informe manualmente o saldo do banco e o apurado no app, e salve o resultado. **Importar** permite importar OFX/CSV/PDF com revisão e detecção de duplicados; isso não significa acesso bancário em tempo real.
6. Metas existentes em Patrimônio recebem cálculo indicativo do valor mensal necessário até o prazo. Nenhum aporte é realizado pela simulação.
7. Avisos de vencimento aparecem na própria tela ao abrir o app; push com aplicativo fechado depende de configuração já descrita em PUSH-SETUP.md.

## Segurança e privacidade

O instalador não acessa dados do navegador. Ele preserva a versão anterior dos arquivos em pasta de backup antes de substituí-los e não altera dependências ou configurações de Firebase. Antes de atualizar, exporte o backup JSON do SaldoPlan, pois os dados locais do navegador não são acessíveis pelo instalador.

`planningSettings` e `bankChecks` entram no mesmo perfil da conta Google, portanto seguem as regras atuais do Live Sync. O Live Sync não usa criptografia ponta a ponta por senha adicional; administradores autorizados do Firebase podem tecnicamente ler os registros.

## Limitações conhecidas

- Projeção não equivale a saldo bancário oficial; considere apenas lançamentos previstos efetivamente cadastrados.
- Não existe sincronização automática com bancos ou cartões. Conferência bancária é uma comparação **manual** e não baixa transações.
- Simulação de compra não a registra nem reserva limite automaticamente.
- Alertas internos só são exibidos ao usar o aplicativo. Push requer infraestrutura e permissão separadas.
- Não modifica cálculo de FGTS, folha, descontos ou benefícios.

## Homologação

Valide em navegador desktop e Android: navegar, salvar saldo, previsão, dados antigos, 2 cartões, compra parcelada em virada de mês, metas, conferência, Login Google, Live Sync e reentrada offline/online. Faça deploy Preview antes de publicar na `main`.
