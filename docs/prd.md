PRD — Plataforma de Reativação de Clientes Inativos via WhatsApp
1. Visão do Produto
Problema

Empresas frequentemente possuem bases grandes de clientes inativosque

esqueceram da marca

encontraram concorrentes

tiveram uma experiência ruim

não receberam novos incentivos

falta de comunicação

A maioria das empresas não possui um processo estruturado de reativação.

Isso gera:

perda de receita

baixo LTV

CAC, mas

desperdício de base de clientes

Então

Criar uma plataforma SaaS que reativa clientes automaticamente através do WhatsApp.

Fluxo principal:

Empresa envia uma lista de clientes (Excel / CSV)

Pla

nome

telefone

Sistema inicia campanha automática via WhatsApp

Mensagem amigável pergunta por que o cliente parou de comprar

Pl

Sistema oferece cupom ou desconto personalizado

clientes

Pró

Ótimo

Aum

Entender motivos de churn

C

Público-Alvo

P

Ele mesmo

ecomm

clínica

academia

r

lojas físicas

eu

com

Ben

Com

M

Zenv

Rua RD

T

Fogo

Prod

2.
Meu

um

recuperar clientes inativos

reduzir CAC

gerar inteligência sobre churn

KP
Métrica	Descrição
Enfrentando	%
Taxa	% cli
Junto	% uso do desconto
Temp	t
N

Clie

3.
Modelo

Está planejado?

quanto a

enquanto

Pl
Plano	Contatos	Preço
São	1	$ 2
Gro	50	$7
Pró	20	$ 19
4. É
Func

Carregar

Extração automática de dados

Pintar

Criação de campanhas

Homens

Coleta de respostas

Aulas

Distr

Painel

F

segmento

templates de mensagens

ou

não

Fora d

bater papo

CRM

No

5
UM
Front-end
↓
API
↓ 
F
↓ 
Wh
↓ 
Clie
↓
Web
↓
Anali
São
Front-end

Próximo.j

Reagir

Cauda

Interface do usuário Shadcn

Assar

Node.js

Ninho

Banco D

Publicar

Linhas

Redi

Esse

Infraestrutura

AWS

Em

Grande

AWS S3 (arquivos excel)

6. Estrutura de Páginas
1 Painel de instrumentos

não

que

taxa de resposta

clientes reativados

cupons utilizados

2. Carregamento de lista

Era

acima

pré-visualização

validação de números

3 câmeras

Criar campanha de reativação.

Campos:

nome de

templo

de

4 Continuação

Lista de clientes:

nome

t

estatística

respondeu / não respondeu

5 A

E

resposta

motivos de rotatividade

taxa de conversão

7. Fluxo de Usuário
Fluxo principal
Conecte-seRegistros
 ↓
Criar campanha
 ↓
Upload Excel
 ↓
Sistema extrai dados
 ↓
Sistema envia mensagens
 ↓
Cliente responde
 ↓
Sistema analisa resposta
 ↓
Sistema envia desconto
 ↓
Cliente recompra
8. Sobre
Tabela: Users
campo	tipo
eu ia	ele
email	tira
p	_
cria	tim_
Tabela: Contacts
campo	tipo
eu ia	uuid
n	s
p	s
status	s
durar	_
T
campo	tipo
eu ia	em
usuário	em_
n	str
nós	_
De	inteiro
Tabela: Messages
campo	tipo
eu ia	ótimo
c	em_
co	uuid
estado	tira
s	tim_
Tabela: Responses
campo	tipo
eu ia	uuid
bagunça	ótimo_
resposta	o
ré	str_
9. Regras de Negócio
Envio de mensagens

evitar spam

limitar envio por minuto

Perdido

mensagem usa variáveis:

Olá {{nome}}, sentimos sua falta!
Gostaríamos de saber por que você não voltou a comprar conosco.
Classificação

C

preço

concordar

experiência ruim

falta

outro

10. S

Wor

Mensagem enviada
 ↓
Cliente responde
 ↓
Sistema detecta intenção
 ↓
Sistema classifica motivo
 ↓
Sistema envia cupom
11

UM

EM

T

Zenvia

360D

Func

envi

ré

rua

1

D

Desempenho

enquanto

r

ré

Coragem

Gr

preço

com

esperar

13. UX

Interf

N

Listra

Linear

Princípio

futuro

foco em campanhas

visual c

C

que

guia

amor

14.
UM

J

OAuth opcional

LG

c

opção de exclusão

Sol

evitar bloqueio do WhatsApp

15
MVP

em

em

coleta de respostas

dashbo

Em

classe

c

temperatura

Isca

IA para análise de respostas

eles mesmos

integr

16. Ins
Ordem de construção

S

UM

Acima

Bem

Número inteiro

Fila de envio

Webhook de r

Painel

17. F

Possível upgrade:

A IA analisa a resposta.

Cliente: parei de comprar porque achei caro

IA cl